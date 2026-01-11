#!/usr/bin/env bash
set -euo pipefail

info() { printf "\n[INFO] %s\n" "$*"; }
pass() { printf "[PASS] %s\n" "$*"; }
fail() { printf "[FAIL] %s\n" "$*"; exit 1; }

trap 'echo "[FAIL] line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/dotenv.sh"

# Acquire tokens (stdout is exports only)
eval "$(bash scripts/oauth_session.sh export)"

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

json_count_url() {
  local json="$1"
  local url="$2"
  python -c 'import json,sys
url=sys.argv[1]
raw=sys.stdin.read().strip()
items=json.loads(raw).get("items", []) if raw else []
count=sum(1 for item in items if item.get("url_original") == url)
print(count)
' "$url" <<<"$json"
}

json_find_id_by_url() {
  local json="$1"
  local url="$2"
  python -c 'import json,sys
url=sys.argv[1]
raw=sys.stdin.read().strip()
items=json.loads(raw).get("items", []) if raw else []
for it in items:
  if it.get("url_original")==url:
    print(it.get("id",""))
    break
' "$url" <<<"$json"
}

json_find_field_by_url() {
  local json="$1"
  local url="$2"
  local field="$3"
  python -c 'import json,sys
url=sys.argv[1]
field=sys.argv[2]
raw=sys.stdin.read().strip()
items=json.loads(raw).get("items", []) if raw else []
for it in items:
  if it.get("url_original")==url:
    value=it.get(field, "")
    print("" if value is None else value)
    break
' "$url" "$field" <<<"$json"
}

require_env ACCESS_TOKEN

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
ITEM_URL="${ITEM_URL:-https://example.com/p1}"
DISPLAY_TITLE="${DISPLAY_TITLE:-Hinted Title}"
DISPLAY_DOMAIN="${DISPLAY_DOMAIN:-example.com}"

info "BASE_URL=$BASE_URL"
info "ITEM_URL=$ITEM_URL"

info "POST /items (first submit)"
post_json=$(curl -sS -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$ITEM_URL\",\"display_product_title\":\"$DISPLAY_TITLE\",\"display_merchant_domain\":\"$DISPLAY_DOMAIN\"}" \
  "$BASE_URL/items")

ITEM_ID_1="$(json_get "$post_json" "item.id")"
[[ -n "$ITEM_ID_1" ]] || { echo "$post_json" >&2; fail "POST did not return item.id"; }
pass "POST returned item.id=$ITEM_ID_1"

POST_TITLE="$(json_get "$post_json" "item.display_product_title")"
POST_DOMAIN="$(json_get "$post_json" "item.display_merchant_domain")"
[[ "$POST_TITLE" == "$DISPLAY_TITLE" ]] || { echo "$post_json" >&2; fail "POST did not echo display_product_title"; }
[[ "$POST_DOMAIN" == "$DISPLAY_DOMAIN" ]] || { echo "$post_json" >&2; fail "POST did not echo display_merchant_domain"; }
pass "POST echoed display_* hints"

info "GET /items after first submit"
list_json=$(curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/items")
count_url=$(json_count_url "$list_json" "$ITEM_URL")
[[ "$count_url" == "1" ]] || { echo "$list_json" >&2; fail "Expected 1 item with url_original, got $count_url"; }
pass "GET list contains 1 item for url_original"

LIST_TITLE="$(json_find_field_by_url "$list_json" "$ITEM_URL" "display_product_title")"
LIST_DOMAIN="$(json_find_field_by_url "$list_json" "$ITEM_URL" "display_merchant_domain")"
[[ "$LIST_TITLE" == "$DISPLAY_TITLE" ]] || { echo "$list_json" >&2; fail "GET did not include display_product_title"; }
[[ "$LIST_DOMAIN" == "$DISPLAY_DOMAIN" ]] || { echo "$list_json" >&2; fail "GET did not include display_merchant_domain"; }
pass "GET list includes display_* fields"

info "POST /items (same url, idempotent)"
post_json_2=$(curl -sS -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$ITEM_URL\"}" \
  "$BASE_URL/items")

ITEM_ID_2="$(json_get "$post_json_2" "item.id")"
[[ -n "$ITEM_ID_2" ]] || { echo "$post_json_2" >&2; fail "Second POST did not return item.id"; }
[[ "$ITEM_ID_1" == "$ITEM_ID_2" ]] || fail "Expected same item.id on second POST (got $ITEM_ID_1 vs $ITEM_ID_2)"
pass "Second POST returned same item.id"

info "GET /items after second submit"
list_json_2=$(curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/items")
count_url_2=$(json_count_url "$list_json_2" "$ITEM_URL")
[[ "$count_url_2" == "1" ]] || { echo "$list_json_2" >&2; fail "Expected 1 item with url_original after second POST, got $count_url_2"; }

LIST_ITEM_ID="$(json_find_id_by_url "$list_json_2" "$ITEM_URL")"
[[ "$LIST_ITEM_ID" == "$ITEM_ID_1" ]] || fail "Expected list item id to match posted id ($ITEM_ID_1), got $LIST_ITEM_ID"
pass "GET list remains idempotent"

require_env SUPABASE_URL
require_env SUPABASE_ANON_KEY
require_env TEST_USER_EMAIL
require_env TEST_USER_PASSWORD

SUPABASE_SESSION_COOKIE_NAME="${SUPABASE_SESSION_COOKIE_NAME:-sb-access-token}"

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

info "POST /api/items/$ITEM_ID_1/delete"
delete_json=$(curl -sS -X POST \
  -H "Cookie: $cookie_header" \
  "$BASE_URL/api/items/$ITEM_ID_1/delete")

delete_ok="$(json_get "$delete_json" "ok")"
[[ "$delete_ok" == "true" ]] || { echo "$delete_json" >&2; fail "Expected delete ok=true"; }
pass "Delete ok"

info "GET /api/items after delete"
list_deleted_json=$(curl -sS -H "Cookie: $cookie_header" "$BASE_URL/api/items")
count_url_deleted=$(json_count_url "$list_deleted_json" "$ITEM_URL")
[[ "$count_url_deleted" == "0" ]] || { echo "$list_deleted_json" >&2; fail "Expected deleted item to be filtered out"; }
pass "Deleted item removed from list"

info "POST /api/items/$ITEM_ID_1/restore"
restore_json=$(curl -sS -X POST \
  -H "Cookie: $cookie_header" \
  "$BASE_URL/api/items/$ITEM_ID_1/restore")

restore_ok="$(json_get "$restore_json" "ok")"
[[ "$restore_ok" == "true" ]] || { echo "$restore_json" >&2; fail "Expected restore ok=true"; }
pass "Restore ok"

info "GET /api/items after restore"
list_restore_json=$(curl -sS -H "Cookie: $cookie_header" "$BASE_URL/api/items")
count_url_restore=$(json_count_url "$list_restore_json" "$ITEM_URL")
[[ "$count_url_restore" == "1" ]] || { echo "$list_restore_json" >&2; fail "Expected restored item in list"; }
pass "Restored item appears in list"

info "ITEMS SMOKE TESTS PASSED ✅"
