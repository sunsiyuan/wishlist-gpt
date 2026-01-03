#!/usr/bin/env bash
set -euo pipefail

info() { printf "\n[INFO] %s\n" "$*"; }
warn() { printf "[WARN] %s\n" "$*"; }
pass() { printf "[PASS] %s\n" "$*"; }
fail() { printf "[FAIL] %s\n" "$*"; exit 1; }

trap 'echo "[FAIL] line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

# Load .env.local/.env (and preserve BASE_URL if caller set it)
# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/dotenv.sh"

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
CLIENT_ID="${CLIENT_ID:-wishlistgpt-dev}"
REDIRECT_URI="${REDIRECT_URI:-$BASE_URL${OAUTH_REDIRECT_PATH:-/dev/callback}}"

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

SESSION_KEY="${OAUTH_SESSION_KEY:-}"
if [[ -z "$SESSION_KEY" ]]; then SESSION_KEY="$(derive_session_key)"; fi

tmp_dir="scripts/.tmp"
session_json="$tmp_dir/oauth_session.${SESSION_KEY}.json"

info "Preflight context"
info "BASE_URL=$BASE_URL"
info "CLIENT_ID=$CLIENT_ID"
info "REDIRECT_URI=$REDIRECT_URI"
info "SESSION_KEY=$SESSION_KEY"

# ---- A) Reachability / Proxy sanity ----
curl_head() {
  local url="$1"
  curl -sS -I --max-time 8 --connect-timeout 4 "$url" >/dev/null
}

info "Network check: reach BASE_URL"
if curl_head "$BASE_URL/"; then
  pass "Reachable: $BASE_URL/"
else
  warn "Cannot reach: $BASE_URL/ (likely proxy/network)"
  info "Proxy env (current shell):"
  echo "  HTTPS_PROXY=${HTTPS_PROXY:-}"
  echo "  HTTP_PROXY=${HTTP_PROXY:-}"
  echo "  ALL_PROXY=${ALL_PROXY:-}"
  echo "  NO_PROXY=${NO_PROXY:-}"
  echo
  warn "If you need a proxy, export HTTPS_PROXY/ALL_PROXY in your shell (or configure your terminal to inherit it)."
  warn "This is why curl returns 000 / timeout on staging/prod."
  fail "Network unreachable"
fi

# ---- B) Env sanity for Supabase keys ----
check_key_clean() {
  local name="$1"
  local v="${!name:-}"
  [[ -n "$v" ]] || fail "Missing env: $name (check .env.local and dotenv loading)"
  # Detect inline comments / whitespace corruption
  python - "$name" "$v" <<'PY'
import sys,re
name=sys.argv[1]
v=sys.argv[2]
bad=[]
if re.search(r"\s", v): bad.append("contains_whitespace")
if "#" in v: bad.append("contains_hash")
if bad:
  print(f"[FAIL] {name} looks corrupted: {bad}. Put comments on separate lines; wrap value in quotes.", file=sys.stderr)
  sys.exit(2)
print("ok")
PY
}

info "Supabase config sanity"
check_key_clean SUPABASE_URL >/dev/null
check_key_clean SUPABASE_ANON_KEY >/dev/null

# Print prefix+len only (no secrets)
anon_prefix="${SUPABASE_ANON_KEY:0:14}"
anon_len="${#SUPABASE_ANON_KEY}"
info "SUPABASE_URL=$SUPABASE_URL"
info "SUPABASE_ANON_KEY prefix=${anon_prefix}... len=$anon_len"

if [[ "$SUPABASE_ANON_KEY" == sb_publishable_* ]]; then
  pass "Detected Supabase publishable key (sb_publishable_*)"
elif [[ "$SUPABASE_ANON_KEY" == eyJ* ]]; then
  pass "Detected legacy JWT key (eyJ*)"
else
  warn "SUPABASE_ANON_KEY prefix is unusual. If you use new Supabase keys, it should start with sb_publishable_."
fi

# ---- C) Session cache status ----
mkdir -p "$tmp_dir"
if [[ -f "$session_json" ]]; then
  info "Found session cache: $session_json"
else
  info "No session cache yet: $session_json (will login/refresh during smoke)"
fi

# ---- D) Auth/API quick check (fast) ----
# Try to obtain ACCESS_TOKEN via oauth_session export, then hit /me and /items.
if [[ -f "scripts/oauth_session.sh" ]]; then
  info "Auth check: obtain ACCESS_TOKEN via oauth_session.sh export"
  # export prints exports to stdout only; logs go to stderr.
  eval "$(bash scripts/oauth_session.sh export)"

  if [[ -z "${ACCESS_TOKEN:-}" ]]; then
    fail "ACCESS_TOKEN not set after oauth_session export"
  fi
  pass "ACCESS_TOKEN acquired"

  info "API check: GET /me"
  me_json=$(curl -sS --max-time 8 --connect-timeout 4 \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$BASE_URL/me" || true)

  # Expect { user: { id: ... } } or similar; just check it isn't an error/empty.
  python - "$me_json" <<'PY'
import json,sys
raw=sys.argv[1]
try:
  j=json.loads(raw)
except Exception:
  print(raw)
  sys.exit(2)
if "error" in j:
  print(raw)
  sys.exit(2)
print("ok")
PY
  pass "/me looks OK"

  info "API check: GET /items (schema/migration smoke)"
  items_json=$(curl -sS --max-time 8 --connect-timeout 4 \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$BASE_URL/items" || true)

  python - "$items_json" <<'PY'
import json,sys
raw=sys.argv[1]
try:
  j=json.loads(raw)
except Exception:
  print(raw)
  sys.exit(2)
if "error" in j:
  print(raw)
  sys.exit(2)
if "items" not in j or not isinstance(j["items"], list):
  print(raw)
  sys.exit(2)
print("ok")
PY
  pass "/items schema looks OK (items is a list)"
else
  warn "scripts/oauth_session.sh not found; skipping auth checks"
fi

info "PREFLIGHT PASSED ✅"
