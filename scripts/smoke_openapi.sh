#!/usr/bin/env bash
set -euo pipefail

info() { printf "\n[INFO] %s\n" "$*"; }
pass() { printf "[PASS] %s\n" "$*"; }
fail() { printf "[FAIL] %s\n" "$*"; exit 1; }

trap 'echo "[FAIL] line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"

is_localhost=false
if [[ "$BASE_URL" == *localhost* || "$BASE_URL" == *127.0.0.1* ]]; then
  is_localhost=true
fi

validate_openapi_file() {
  local file="$1"
  local label="$2"

  if grep -q "__BASE_URL__" "$file"; then
    fail "$label still contains __BASE_URL__; check build/deploy"
  fi

  if ! grep -q -E "^(openapi:|paths:)" "$file"; then
    fail "$label did not look like OpenAPI YAML"
  fi

  if ! grep -q "/me" "$file"; then
    fail "$label missing /me; check build/deploy"
  fi

  if ! grep -q "/items" "$file"; then
    fail "$label missing /items; check build/deploy"
  fi
}

info "Fetching $BASE_URL/openapi.yaml"
tmpfile="$(mktemp)"
if ! curl -fsS "$BASE_URL/openapi.yaml" -o "$tmpfile"; then
  if [[ "$is_localhost" == true ]]; then
    printf "[SKIP] openapi.yaml not found on local dev. gen:openapi runs in prebuild on Vercel.\n"
    printf "       To validate, set BASE_URL=https://<preview-or-prod-domain> and rerun smoke:openapi\n"
    printf "       (or run npm run build locally).\n"
    exit 0
  fi
  fail "GET $BASE_URL/openapi.yaml failed; ensure the artifact is served"
fi

validate_openapi_file "$tmpfile" "GET $BASE_URL/openapi.yaml"
pass "GET $BASE_URL/openapi.yaml returned OpenAPI with required paths"

if [[ -f "public/openapi.yaml" ]]; then
  validate_openapi_file "public/openapi.yaml" "public/openapi.yaml"
  pass "public/openapi.yaml exists and contains required paths"
fi

info "OPENAPI SMOKE TESTS PASSED ✅"
