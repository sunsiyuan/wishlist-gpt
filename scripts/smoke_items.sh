#!/usr/bin/env bash
set -euo pipefail

info() { printf "\n[INFO] %s\n" "$*"; }
pass() { printf "[PASS] %s\n" "$*"; }
fail() { printf "[FAIL] %s\n" "$*"; exit 1; }

trap 'echo "[FAIL] line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/dotenv.sh"

eval "$(bash scripts/oauth_session.sh ensure --print | sed -n '/^export /p')"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    fail "Missing env: $name"
  fi
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

require_env ACCESS_TOKEN

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
ITEM_URL="${ITEM_URL:-https://example.com/p1}"

info "BASE_URL=$BASE_URL"
info "ITEM_URL=$ITEM_URL"

info "POST /items (first submit)"
post_json=$(curl -sS -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$ITEM_URL\"}" \
  "$BASE_URL/items")

ITEM_ID_1="$(json_get "$post_json" "item.id")"
if [[ -z "$ITEM_ID_1" ]]; then
  echo "$post_json" >&2
  fail "POST did not return item.id"
fi
pass "POST returned item.id=$ITEM_ID_1"

info "GET /items after first submit"
list_json=$(curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/items")
count_url=$(json_count_url "$list_json" "$ITEM_URL")
if [[ "$count_url" != "1" ]]; then
  echo "$list_json" >&2
  fail "Expected 1 item with url_original, got $count_url"
fi
pass "GET list contains 1 item for url_original"

info "POST /items (same url, idempotent)"
post_json_2=$(curl -sS -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$ITEM_URL\"}" \
  "$BASE_URL/items")

ITEM_ID_2="$(json_get "$post_json_2" "item.id")"
if [[ -z "$ITEM_ID_2" ]]; then
  echo "$post_json_2" >&2
  fail "Second POST did not return item.id"
fi
if [[ "$ITEM_ID_1" != "$ITEM_ID_2" ]]; then
  fail "Expected same item.id on second POST (got $ITEM_ID_1 vs $ITEM_ID_2)"
fi
pass "Second POST returned same item.id"

info "GET /items after second submit"
list_json_2=$(curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/items")
count_url_2=$(json_count_url "$list_json_2" "$ITEM_URL")
if [[ "$count_url_2" != "1" ]]; then
  echo "$list_json_2" >&2
  fail "Expected 1 item with url_original after second POST, got $count_url_2"
fi

LIST_ITEM_ID="$(json_find_id_by_url "$list_json_2" "$ITEM_URL")"
if [[ "$LIST_ITEM_ID" != "$ITEM_ID_1" ]]; then
  fail "Expected list item id to match posted id ($ITEM_ID_1), got $LIST_ITEM_ID"
fi
pass "GET list remains idempotent"

info "ITEMS SMOKE TESTS PASSED ✅"
