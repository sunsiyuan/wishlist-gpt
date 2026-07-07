#!/usr/bin/env bash
# Smoke test for the MCP / Apps SDK surface.
# Checks OAuth discovery documents and that the MCP endpoint issues a spec-compliant
# 401 challenge when called without a bearer token.
#
# Usage: BASE_URL=http://localhost:3000 ./scripts/smoke_mcp.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
fail=0

echo "== MCP smoke against ${BASE_URL} =="

check_json() {
  local path="$1" needle="$2"
  local body
  body="$(curl -sf -m 10 "${BASE_URL}${path}")" || { echo "FAIL  GET ${path} (request failed)"; fail=1; return; }
  if echo "$body" | grep -q "$needle"; then
    echo "ok    GET ${path}"
  else
    echo "FAIL  GET ${path} (missing '${needle}')"; fail=1
  fi
}

check_json "/.well-known/oauth-protected-resource" '"resource"'
check_json "/.well-known/oauth-authorization-server" '"code_challenge_methods_supported"'
check_json "/.well-known/oauth-authorization-server" 'S256'

# MCP endpoint must reject unauthenticated calls with 401 + WWW-Authenticate.
echo "== unauthenticated /api/mcp challenge =="
hdrs="$(curl -s -m 15 -D - -o /dev/null -X POST "${BASE_URL}/api/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}')"
if echo "$hdrs" | grep -qi "^HTTP/.* 401" && echo "$hdrs" | grep -qi "www-authenticate:.*resource_metadata"; then
  echo "ok    POST /api/mcp -> 401 with resource_metadata challenge"
else
  echo "FAIL  POST /api/mcp did not return a 401 resource_metadata challenge"; fail=1
fi

if [ "$fail" -ne 0 ]; then echo "== MCP smoke FAILED =="; exit 1; fi
echo "== MCP smoke passed =="
