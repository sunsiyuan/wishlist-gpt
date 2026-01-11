#!/usr/bin/env bash
set -euo pipefail

info() { printf "\n[INFO] %s\n" "$*"; }
pass() { printf "[PASS] %s\n" "$*"; }
fail() { printf "[FAIL] %s\n" "$*"; exit 1; }

# Better error diagnostics
trap 'echo "[FAIL] line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/dotenv.sh"

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "Missing env: $name"
}

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

extract_code_from_url() {
  local url="$1"
  python -c 'import sys,urllib.parse
u=urllib.parse.urlparse(sys.stdin.read().strip())
q=urllib.parse.parse_qs(u.query)
print(q.get("code",[""])[0])
' <<<"$url"
}

derive_session_key() {
  python - <<'PY'
import os, re, urllib.parse
u=os.environ.get("BASE_URL","http://localhost:3000")
p=urllib.parse.urlparse(u)
host=(p.hostname or "local").replace(".","_")
port=f"_{p.port}" if p.port else ""
print(re.sub(r"[^a-zA-Z0-9_]+","_", host+port) or "local")
PY
}

# ---- required env ----
require_env SUPABASE_URL
require_env SUPABASE_ANON_KEY
require_env TEST_USER_EMAIL
require_env TEST_USER_PASSWORD

# ---- optional env (defaults) ----
BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
CLIENT_ID="${CLIENT_ID:-wishlistgpt-dev}"
REDIRECT_URI="${REDIRECT_URI:-$BASE_URL/dev/callback}"   # IMPORTANT: follow BASE_URL (staging/prod)
STATE="${STATE:-state-123}"
EXPECT_SUPABASE_HEADER_BYPASS="${EXPECT_SUPABASE_HEADER_BYPASS:-skip}"
OAUTH_ALLOW_AUTH_HEADER_LOGIN="${OAUTH_ALLOW_AUTH_HEADER_LOGIN:-}"
SUPABASE_SESSION_COOKIE_NAME="${SUPABASE_SESSION_COOKIE_NAME:-sb-access-token}"

SESSION_KEY="${OAUTH_SESSION_KEY:-}"
if [[ -z "$SESSION_KEY" ]]; then
  SESSION_KEY="$(derive_session_key)"
fi

TMP_DIR="scripts/.tmp"
mkdir -p "$TMP_DIR"

info "BASE_URL=$BASE_URL"
info "CLIENT_ID=$CLIENT_ID"
info "REDIRECT_URI=$REDIRECT_URI"
info "EXPECT_SUPABASE_HEADER_BYPASS=$EXPECT_SUPABASE_HEADER_BYPASS"
info "SESSION_KEY=$SESSION_KEY"
info "SUPABASE_SESSION_COOKIE_NAME=$SUPABASE_SESSION_COOKIE_NAME"
if [[ -z "$OAUTH_ALLOW_AUTH_HEADER_LOGIN" ]]; then
  info "OAUTH_ALLOW_AUTH_HEADER_LOGIN is unset (dev default: allow, prod default: deny)"
else
  info "OAUTH_ALLOW_AUTH_HEADER_LOGIN=$OAUTH_ALLOW_AUTH_HEADER_LOGIN"
fi

AUTHZ_URL="$BASE_URL/api/oauth/authorize"

# ---- A0) negative: /auth/callback without code must redirect ----
info "Negative: /auth/callback without code must redirect to /login?error=missing_code"

CALLBACK_HEADERS_PATH="$TMP_DIR/oauth_callback_headers.${SESSION_KEY}.txt"
rm -f "$CALLBACK_HEADERS_PATH"

callback_status=$(curl -sS -D "$CALLBACK_HEADERS_PATH" -o /dev/null -w "%{http_code}" \
  "$BASE_URL/auth/callback" \
  || true)

callback_location="$(grep -i '^location:' "$CALLBACK_HEADERS_PATH" | tail -n 1 | sed -E 's/^location:\s*//I' | tr -d '\r' || true)"

if [[ "$callback_status" =~ ^30[1278]$ ]] && [[ "$callback_location" == *"/login"* ]] && [[ "$callback_location" == *"error=missing_code"* ]]; then
  pass "Callback missing code redirected"
else
  echo "Last headers:" >&2
  cat "$CALLBACK_HEADERS_PATH" >&2 || true
  fail "Expected /auth/callback to redirect to /login?error=missing_code (got status=$callback_status, location=$callback_location)"
fi

seed_cookie_jar() {
  local jar_path="$1"
  local token="$2"
  local cookie_name="$3"
  python - "$jar_path" "$BASE_URL" "$token" "$cookie_name" <<'PY'
import sys, urllib.parse
jar_path = sys.argv[1]
base_url = sys.argv[2]
token = sys.argv[3]
cookie_name = sys.argv[4]
parsed = urllib.parse.urlparse(base_url)
domain = parsed.hostname or "localhost"
secure = "TRUE" if parsed.scheme == "https" else "FALSE"
with open(jar_path, "w", encoding="utf-8") as fh:
    fh.write("# Netscape HTTP Cookie File\n")
    fh.write("\t".join([domain, "TRUE", "/", secure, "0", cookie_name, token]) + "\n")
PY
}

# ---- A) Supabase password grant ----
info "Supabase password grant -> ${SUPABASE_SESSION_COOKIE_NAME}"

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

# ---- B2) Optional: header bypass on/off checks ----
if [[ "$EXPECT_SUPABASE_HEADER_BYPASS" != "skip" ]]; then
  info "Header bypass expectation: $EXPECT_SUPABASE_HEADER_BYPASS"
  BYPASS_COOKIES_PATH="$TMP_DIR/oauth_bypass_cookies.${SESSION_KEY}.txt"
  BYPASS_HEADERS_PATH="$TMP_DIR/oauth_bypass_headers.${SESSION_KEY}.txt"
  rm -f "$BYPASS_COOKIES_PATH" "$BYPASS_HEADERS_PATH"

  BYPASS_CODE=""
  BYPASS_STATUS=""
  BYPASS_LOCATION=""

  for _ in 1 2; do
    BYPASS_STATUS=$(curl -sS -D "$BYPASS_HEADERS_PATH" -o /dev/null -w "%{http_code}" \
      -c "$BYPASS_COOKIES_PATH" -b "$BYPASS_COOKIES_PATH" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      "$AUTHZ_URL?response_type=code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&state=$STATE" \
      || true)

    BYPASS_LOCATION="$(grep -i '^location:' "$BYPASS_HEADERS_PATH" | tail -n 1 | sed -E 's/^location:\s*//I' | tr -d '\r' || true)"
    if [[ -n "$BYPASS_LOCATION" ]]; then
      BYPASS_CODE="$(extract_code_from_url "$BYPASS_LOCATION")"
      if [[ -n "$BYPASS_CODE" ]]; then
        break
      fi
    fi
  done

  if [[ "$EXPECT_SUPABASE_HEADER_BYPASS" == "on" ]]; then
    if [[ -z "$BYPASS_CODE" ]]; then
      echo "Last headers:" >&2
      cat "$BYPASS_HEADERS_PATH" >&2 || true
      fail "Expected header bypass to succeed. Set OAUTH_ALLOW_AUTH_HEADER_LOGIN=true in .env.local, restart the dev server, then rerun."
    fi
    pass "Header bypass accepted (code issued)"
  elif [[ "$EXPECT_SUPABASE_HEADER_BYPASS" == "off" ]]; then
    if [[ "$BYPASS_STATUS" == "401" ]]; then
      pass "Header bypass rejected (401)"
    else
      echo "Last headers:" >&2
      cat "$BYPASS_HEADERS_PATH" >&2 || true
      if [[ -n "$BYPASS_CODE" ]]; then
        fail "Header bypass appears enabled (code issued). Set OAUTH_ALLOW_AUTH_HEADER_LOGIN=false in .env.local, restart the dev server, then rerun."
      fi
      fail "Expected header bypass 401 (got $BYPASS_STATUS). Set OAUTH_ALLOW_AUTH_HEADER_LOGIN=false in .env.local, restart the dev server, then rerun."
    fi
  else
    fail "EXPECT_SUPABASE_HEADER_BYPASS must be on|off|skip"
  fi
fi

# ---- C0) negative: authorize with disallowed redirect_uri must fail ----
info "Negative: /api/oauth/authorize with disallowed redirect_uri must fail"

# Make a "bad" redirect that is guaranteed NOT to match allowlist
BAD_REDIRECT_URI="${REDIRECT_URI}-bad"

status_bad_redirect=$(curl -sS -o /dev/null -w "%{http_code}" \
  "$AUTHZ_URL?response_type=code&client_id=$CLIENT_ID&redirect_uri=$BAD_REDIRECT_URI&state=$STATE" \
  || true)

if [[ "$status_bad_redirect" == "400" ]]; then
  pass "Bad redirect rejected (400)"
else
  fail "Expected 400 for bad redirect_uri, got $status_bad_redirect"
fi

# ---- C) /api/oauth/authorize -> code ----
info "Authorize -> code"

COOKIES_PATH="$TMP_DIR/oauth_cookies.${SESSION_KEY}.txt"
HEADERS_PATH="$TMP_DIR/oauth_headers.${SESSION_KEY}.txt"
rm -f "$COOKIES_PATH" "$HEADERS_PATH"
seed_cookie_jar "$COOKIES_PATH" "$SUPABASE_ACCESS_TOKEN" "$SUPABASE_SESSION_COOKIE_NAME"

CODE=""
LOCATION=""

for _ in 1 2; do
  curl -sS -D "$HEADERS_PATH" -o /dev/null -c "$COOKIES_PATH" -b "$COOKIES_PATH" \
    "$AUTHZ_URL?response_type=code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&state=$STATE" \
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
info "Token exchange: authorization_code -> access_token/refresh_token"

token_json=$(curl -sS -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&code=$CODE" \
  "$BASE_URL/oauth/token")

OAUTH_ACCESS_TOKEN="$(json_get "$token_json" "access_token")"
OAUTH_REFRESH_TOKEN="$(json_get "$token_json" "refresh_token")"

if [[ -z "$OAUTH_ACCESS_TOKEN" ]]; then
  echo "$token_json" >&2
  fail "Token exchange missing access_token"
fi
pass "Token exchange OK (access_token)"

# ---- E) Optional: refresh_token -> new access_token ----
if [[ -n "$OAUTH_REFRESH_TOKEN" ]]; then
  info "Refresh access token"
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
