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

require_env SUPABASE_URL
require_env SUPABASE_ANON_KEY
require_env TEST_USER_EMAIL
require_env TEST_USER_PASSWORD

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"

info "BASE_URL=$BASE_URL"

info "Supabase password grant -> sb-access-token"
supabase_json=$(curl -sS \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" \
  "$SUPABASE_URL/auth/v1/token?grant_type=password")

SUPABASE_ACCESS_TOKEN="$(json_get "$supabase_json" "access_token")"
[[ -n "$SUPABASE_ACCESS_TOKEN" ]] || { echo "$supabase_json" >&2; fail "Failed to get Supabase access_token"; }
pass "Supabase user token OK"

cookie_header="sb-access-token=$SUPABASE_ACCESS_TOKEN"

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
