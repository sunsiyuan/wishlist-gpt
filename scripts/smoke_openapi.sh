#!/usr/bin/env bash
set -euo pipefail

info() { printf "\n[INFO] %s\n" "$*"; }
pass() { printf "[PASS] %s\n" "$*"; }
fail() { printf "[FAIL] %s\n" "$*"; exit 1; }

trap 'echo "[FAIL] line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"

if [[ "$BASE_URL" == *localhost* || "$BASE_URL" == *127.0.0.1* ]]; then
  info "Local BASE_URL detected ($BASE_URL); running npm run gen:openapi"
  npm run gen:openapi
fi

OPENAPI_FILE="public/openapi.yaml"

if [[ ! -f "$OPENAPI_FILE" ]]; then
  fail "Missing $OPENAPI_FILE. Run: npm run gen:openapi"
fi

if grep -q "__BASE_URL__" "$OPENAPI_FILE"; then
  fail "$OPENAPI_FILE still contains __BASE_URL__. Run: npm run gen:openapi"
fi

if ! grep -q "^paths:" "$OPENAPI_FILE"; then
  fail "$OPENAPI_FILE missing paths section; regenerate OpenAPI"
fi

if ! grep -q "/me" "$OPENAPI_FILE"; then
  fail "$OPENAPI_FILE missing /me path; regenerate OpenAPI"
fi

if ! grep -q "/items" "$OPENAPI_FILE"; then
  fail "$OPENAPI_FILE missing /items path; regenerate OpenAPI"
fi

pass "$OPENAPI_FILE exists and contains required paths"

info "Fetching $BASE_URL/openapi.yaml"
curl -fsS "$BASE_URL/openapi.yaml" -o /tmp/openapi.yaml

if ! grep -q -E "^(openapi:|paths:)" /tmp/openapi.yaml; then
  fail "GET $BASE_URL/openapi.yaml did not return OpenAPI YAML"
fi

if grep -q "__BASE_URL__" /tmp/openapi.yaml; then
  fail "GET $BASE_URL/openapi.yaml still contains __BASE_URL__; check deploy"
fi

if ! grep -q "/me" /tmp/openapi.yaml; then
  fail "GET $BASE_URL/openapi.yaml missing /me; check deploy"
fi

if ! grep -q "/items" /tmp/openapi.yaml; then
  fail "GET $BASE_URL/openapi.yaml missing /items; check deploy"
fi

pass "GET $BASE_URL/openapi.yaml returned OpenAPI with required paths"

info "OPENAPI SMOKE TESTS PASSED ✅"
