#!/usr/bin/env bash
set -euo pipefail

info() { printf "\n[INFO] %s\n" "$*"; }
pass() { printf "[PASS] %s\n" "$*"; }
fail() { printf "[FAIL] %s\n" "$*"; exit 1; }

# Better error diagnostics
trap 'echo "[FAIL] line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    fail "Missing env: $name"
  fi
}

# json_get <json> <key>
json_get() {
  local json="$1"
  local key="$2"
  python -c 'import json,sys
key=sys.argv[1]
raw=sys.stdin.read().strip()
data=json.loads(raw) if raw else {}
val=data.get(key,"")
print("" if val is None else val)
' "$key" <<<"$json"
}

# extract code from a Location URL query string
extract_code_from_url() {
  local url="$1"
  python -c 'import sys,urllib.parse
u=urllib.parse.urlparse(sys.stdin.read().strip())
q=urllib.parse.parse_qs(u.query)
print(q.get("code",[""])[0])
' <<<"$url"
}

# ---- required env ----
require_env SUPABASE_URL
require_env SUPABASE_ANON_KEY
require_env TEST_USER_EMAIL
require_env TEST_USER_PASSWORD

# ---- optional env (defaults) ----
BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
CLIENT_ID="${CLIENT_ID:-local-dev-client}"
REDIRECT_URI="${REDIRECT_URI:-http://localhost:3000/dev/callback}"
STATE="${STATE:-state-123}"

info "BASE_URL=$BASE_URL"
info "CLIENT_ID=$CLIENT_ID"
info "REDIRECT_URI=$REDIRECT_URI"

# ---- 0) server reachable ----
info "Check server reachable"
curl -sS -o /dev/null "$BASE_URL/" || fail "Server not reachable at $BASE_URL"
pass "Server reachable"

# ---- A) route existence sanity ----
info "Sanity: /oauth/authorize exists (400 or 401)"
status_authz=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-redirs 5 "$BASE_URL/oauth/authorize")
if [[ "$status_authz" == "400" || "$status_authz" == "401" ]]; then
  pass "/oauth/authorize exists ($status_authz)"
else
  fail "/oauth/authorize expected 400/401, got $status_authz"
fi

info "Sanity: /me returns 401 (protected)"
status_me=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/me")
[[ "$status_me" == "401" ]] || fail "/me expected 401, got $status_me"
pass "/me protected"

# ---- B) Supabase password grant ----
info "Supabase password grant -> user access token"
supabase_json=$(curl -sS \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" \
  "$SUPABASE_URL/auth/v1/token?grant_type=password")

SUPABASE_ACCESS_TOKEN="$(json_get "$supabase_json" "access_token")"
if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  echo "$supabase_json" >&2
  fail "Failed to get Supabase access_token (check email/password, provider enabled, email confirmation)"
fi
pass "Supabase user token OK"

# ---- C0) negative: authorize with disallowed redirect_uri must fail ----
info "Negative: /oauth/authorize with disallowed redirect_uri must fail"

# Make a "bad" redirect that is guaranteed NOT to match allowlist
BAD_REDIRECT_URI="${REDIRECT_URI}-bad"

status_bad_redirect=$(curl -sS -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "$BASE_URL/oauth/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=$BAD_REDIRECT_URI&state=$STATE" \
  || true)

[[ "$status_bad_redirect" == "400" ]] || fail "Disallowed redirect expected 400, got $status_bad_redirect"
pass "Disallowed redirect_uri rejected (400)"

# ---- C) /oauth/authorize -> code (one-shot or two-shot supported) ----
info "Authorize -> code"

TMP_DIR="scripts/.tmp"
mkdir -p "$TMP_DIR"
COOKIES_PATH="$TMP_DIR/oauth_cookies.txt"
HEADERS_PATH="$TMP_DIR/oauth_headers.txt"
rm -f "$COOKIES_PATH" "$HEADERS_PATH"

CODE=""
LOCATION=""

for _ in 1 2; do
  curl -sS -D "$HEADERS_PATH" -o /dev/null -c "$COOKIES_PATH" -b "$COOKIES_PATH" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "$BASE_URL/oauth/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&state=$STATE" \
    || true

  LOCATION="$(grep -i '^location:' "$HEADERS_PATH" | tail -n 1 | sed -E 's/^location:\s*//I' | tr -d '\r' || true)"
  if [[ -n "$LOCATION" ]]; then
    CODE="$(extract_code_from_url "$LOCATION")"
    if [[ -n "$CODE" ]]; then
      break
    fi
  fi
done

if [[ -z "$CODE" ]]; then
  echo "Last headers:" >&2
  cat "$HEADERS_PATH" >&2 || true
  fail "Failed to obtain code from authorize redirect (check allowlist/state/login recognition)"
fi
pass "Got code from authorize"

# ---- D) /oauth/token code exchange ----
info "Token exchange (authorization_code)"
token_json=$(curl -sS -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&code=$CODE" \
  "$BASE_URL/oauth/token")

OAUTH_ACCESS_TOKEN="$(json_get "$token_json" "access_token")"
if [[ -z "$OAUTH_ACCESS_TOKEN" ]]; then
  echo "$token_json" >&2
  fail "Token exchange did not return access_token"
fi
pass "Token exchange OK"

OAUTH_REFRESH_TOKEN="$(json_get "$token_json" "refresh_token")"

# ---- D2) negative: replay same code must fail ----
info "Negative: replay same code must fail"
status_replay=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&code=$CODE" \
  "$BASE_URL/oauth/token")
[[ "$status_replay" == "400" ]] || fail "Replay expected 400, got $status_replay"
pass "Code is one-time (replay fails)"

# ---- E) /me with OAuth access token ----
info "Call /me with OAuth access token"
me_json=$(curl -sS -H "Authorization: Bearer $OAUTH_ACCESS_TOKEN" "$BASE_URL/me")

USER_ID="$(json_get "$me_json" "user_id")"
if [[ -z "$USER_ID" ]]; then
  echo "$me_json" >&2
  fail "/me did not return user_id"
fi
pass "/me returned user_id=$USER_ID"

# ---- E2) negative: /me with invalid token must fail ----
info "Negative: /me with invalid token must fail"
status_me_invalid=$(curl -sS -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer not-a-real-token" \
  "$BASE_URL/me" \
  || true)

# Accept 401 (preferred) or 400 depending on implementation
if [[ "$status_me_invalid" == "401" || "$status_me_invalid" == "400" ]]; then
  pass "/me rejects invalid token ($status_me_invalid)"
else
  fail "/me invalid token expected 401/400, got $status_me_invalid"
fi

# ---- F) refresh (optional) ----
if [[ -n "${OAUTH_REFRESH_TOKEN:-}" ]]; then
  info "Refresh flow"
  refresh_json=$(curl -sS -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=refresh_token&client_id=$CLIENT_ID&refresh_token=$OAUTH_REFRESH_TOKEN" \
    "$BASE_URL/oauth/token")

  NEW_ACCESS="$(json_get "$refresh_json" "access_token")"
  if [[ -z "$NEW_ACCESS" ]]; then
    echo "$refresh_json" >&2
    fail "Refresh did not return new access_token"
  fi
  pass "Refresh OK"
else
  info "No refresh_token returned; skipping refresh test"
fi

info "ALL OAUTH SMOKE TESTS PASSED ✅"
