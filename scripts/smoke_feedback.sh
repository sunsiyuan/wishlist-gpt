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

require_env ACCESS_TOKEN

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"

json_get() {
  local json="$1"
  local key="$2"
  python -c 'import json,sys
key=sys.argv[1]
raw=sys.stdin.read().strip()
data=json.loads(raw) if raw else {}
val=data.get(key, "")
print("" if val is None else val)
' "$key" <<<"$json"
}

info "BASE_URL=$BASE_URL"

info "POST /feedback (first submit)"
response=$(curl -sS -o /tmp/feedback_1.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Feedback smoke","context":{"page":"/smoke"}}' \
  "$BASE_URL/feedback")

if [[ "$response" != "200" ]]; then
  cat /tmp/feedback_1.json >&2
  fail "Expected 200 on first POST, got $response"
fi

ok_value="$(json_get "$(cat /tmp/feedback_1.json)" "ok")"
[[ "$ok_value" == "true" ]] || { cat /tmp/feedback_1.json >&2; fail "Expected ok=true"; }
pass "First POST ok"

info "POST /feedback (rate limit)"
response_2=$(curl -sS -o /tmp/feedback_2.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Feedback smoke","context":{"page":"/smoke"}}' \
  "$BASE_URL/feedback")

if [[ "$response_2" != "429" ]]; then
  cat /tmp/feedback_2.json >&2
  fail "Expected 429 on second POST, got $response_2"
fi
pass "Rate limit enforced"

info "POST /feedback (message too long)"
long_message=$(python - <<'PY'
print('x' * 1001)
PY
)
response_3=$(curl -sS -o /tmp/feedback_3.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$long_message\",\"context\":{\"page\":\"/smoke\"}}" \
  "$BASE_URL/feedback")

if [[ "$response_3" != "400" ]]; then
  cat /tmp/feedback_3.json >&2
  fail "Expected 400 on long message, got $response_3"
fi
pass "Long message rejected"

info "FEEDBACK SMOKE TESTS PASSED ✅"
