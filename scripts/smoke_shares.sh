#!/usr/bin/env bash
set -euo pipefail

info() { printf "\n[INFO] %s\n" "$*"; }
pass() { printf "[PASS] %s\n" "$*"; }
fail() { printf "[FAIL] %s\n" "$*"; exit 1; }

trap 'echo "[FAIL] line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/dotenv.sh"

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "Missing env: $name"
}

json_get() {
  local json="$1"
  local path="$2"
  python -c 'import json,sys
path=sys.argv[1]
raw=sys.stdin.read().strip()
data=json.loads(raw) if raw else {}
cur=data
for part in path.split("."):
    if isinstance(cur, dict):
        cur=cur.get(part, "")
    else:
        cur=""
        break
print("" if cur is None else cur)
' "$path" <<<"$json"
}

extract_code_from_url() {
  local url="$1"
  python -c 'import sys,urllib.parse
u=urllib.parse.urlparse(sys.stdin.read().strip())
q=urllib.parse.parse_qs(u.query)
print(q.get("code",[""])[0])
' <<<"$url"
}

require_env SUPABASE_URL
require_env SUPABASE_ANON_KEY
require_env TEST_USER_EMAIL
require_env TEST_USER_PASSWORD

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
SUPABASE_SESSION_COOKIE_NAME="${SUPABASE_SESSION_COOKIE_NAME:-sb-access-token}"
CLIENT_ID="${CLIENT_ID:-wishlistgpt-dev}"
REDIRECT_URI="${REDIRECT_URI:-$BASE_URL/dev/callback}"
STATE="${STATE:-state-123}"
AUTHZ_URL="$BASE_URL/api/oauth/authorize"
TMP_DIR="scripts/.tmp"
mkdir -p "$TMP_DIR"

info "BASE_URL=$BASE_URL"
info "SUPABASE_SESSION_COOKIE_NAME=$SUPABASE_SESSION_COOKIE_NAME"

info "Supabase password grant -> ${SUPABASE_SESSION_COOKIE_NAME}"
supabase_json=$(curl -sS \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" \
  "$SUPABASE_URL/auth/v1/token?grant_type=password")

SUPABASE_ACCESS_TOKEN="$(json_get "$supabase_json" "access_token")"
[[ -n "$SUPABASE_ACCESS_TOKEN" ]] || { echo "$supabase_json" >&2; fail "Failed to get Supabase access_token"; }
pass "Supabase user token OK"

cookie_header="${SUPABASE_SESSION_COOKIE_NAME}=$SUPABASE_ACCESS_TOKEN"

info "OAuth authorize -> access token (for /shares)"
OAUTH_HEADERS_PATH="$TMP_DIR/shares_oauth_headers.txt"
rm -f "$OAUTH_HEADERS_PATH"
CODE=""

for _ in 1 2; do
  curl -sS -D "$OAUTH_HEADERS_PATH" -o /dev/null \
    -H "Cookie: $cookie_header" \
    "$AUTHZ_URL?response_type=code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&state=$STATE" \
    || true

  LOCATION="$(grep -i '^location:' "$OAUTH_HEADERS_PATH" | tail -n 1 | sed -E 's/^location:\s*//I' | tr -d '\r' || true)"
  if [[ -n "$LOCATION" ]]; then
    CODE="$(extract_code_from_url "$LOCATION")"
    if [[ -n "$CODE" ]]; then
      break
    fi
  fi
done

if [[ -z "$CODE" ]]; then
  echo "Last headers:" >&2
  cat "$OAUTH_HEADERS_PATH" >&2 || true
  fail "Failed to obtain OAuth code for shares"
fi

token_json=$(curl -sS -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&code=$CODE" \
  "$BASE_URL/oauth/token")

OAUTH_ACCESS_TOKEN="$(json_get "$token_json" "access_token")"
[[ -n "$OAUTH_ACCESS_TOKEN" ]] || { echo "$token_json" >&2; fail "Failed to get OAuth access_token"; }
pass "OAuth access token OK"

info "POST /shares (Bearer)"
actions_share_json=$(curl -sS -X POST \
  -H "Authorization: Bearer $OAUTH_ACCESS_TOKEN" \
  "$BASE_URL/shares")

ACTIONS_SHARE_ID="$(json_get "$actions_share_json" "share_id")"
ACTIONS_SHARE_URL="$(json_get "$actions_share_json" "share_url")"
[[ -n "$ACTIONS_SHARE_ID" ]] || { echo "$actions_share_json" >&2; fail "POST /shares did not return share_id"; }
expected_share_url="${BASE_URL}/s/${ACTIONS_SHARE_ID}"
[[ "$ACTIONS_SHARE_URL" == "$expected_share_url" ]] || {
  echo "$actions_share_json" >&2
  fail "POST /shares returned unexpected share_url ($ACTIONS_SHARE_URL)"
}
pass "Actions share OK ($ACTIONS_SHARE_ID)"

info "POST /api/shares with Authorization header rejected"
api_auth_response_path="$TMP_DIR/shares_api_auth.json"
api_auth_status=$(curl -sS -o "$api_auth_response_path" -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $OAUTH_ACCESS_TOKEN" \
  "$BASE_URL/api/shares")

api_auth_body="$(cat "$api_auth_response_path")"
api_auth_error="$(json_get "$api_auth_body" "error")"
[[ "$api_auth_status" == "401" ]] || { echo "$api_auth_body" >&2; fail "Expected 401 for /api/shares with Authorization header"; }
[[ "$api_auth_error" == "bearer_not_allowed" ]] || { echo "$api_auth_body" >&2; fail "Expected bearer_not_allowed for /api/shares with Authorization header"; }
pass "Authorization header rejected for /api/shares"

info "POST /api/shares (create/reuse)"
create_json=$(curl -sS -X POST \
  -H "Cookie: $cookie_header" \
  "$BASE_URL/api/shares")

SHARE_ID_A="$(json_get "$create_json" "share_id")"
[[ -n "$SHARE_ID_A" ]] || { echo "$create_json" >&2; fail "POST /api/shares did not return share_id"; }
pass "Got share_id_a=$SHARE_ID_A"

info "POST /api/shares/rotate (new share)"
rotate_json=$(curl -sS -X POST \
  -H "Cookie: $cookie_header" \
  "$BASE_URL/api/shares/rotate")

SHARE_ID_B="$(json_get "$rotate_json" "share_id")"
[[ -n "$SHARE_ID_B" ]] || { echo "$rotate_json" >&2; fail "POST /api/shares/rotate did not return share_id"; }
[[ "$SHARE_ID_A" != "$SHARE_ID_B" ]] || fail "Expected rotated share_id to differ ($SHARE_ID_A vs $SHARE_ID_B)"
pass "Rotated share_id_b=$SHARE_ID_B"

info "SHARES SMOKE TESTS PASSED ✅"
