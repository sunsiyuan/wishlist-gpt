#!/usr/bin/env bash
set -euo pipefail

LOG_FD=1
info() { printf "\n[INFO] %s\n" "$*" >&${LOG_FD}; }
pass() { printf "[PASS] %s\n" "$*" >&${LOG_FD}; }
fail() { printf "[FAIL] %s\n" "$*" >&2; exit 1; }

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

now_epoch() {
  python - <<'PY'
import time
print(int(time.time()))
PY
}

extract_code_from_url() {
  local url="$1"
  python -c 'import sys,urllib.parse
u=urllib.parse.urlparse(sys.stdin.read().strip())
q=urllib.parse.parse_qs(u.query)
print(q.get("code",[""])[0])
' <<<"$url"
}

# ---- config ----
BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"

CLIENT_ID="${CLIENT_ID:-wishlistgpt-dev}"
REDIRECT_PATH="${OAUTH_REDIRECT_PATH:-/dev/callback}"
REDIRECT_URI="${REDIRECT_URI:-${BASE_URL}${REDIRECT_PATH}}"
STATE="${STATE:-state-123}"

AUTHZ_URL="$BASE_URL/api/oauth/authorize"
TOKEN_URL="$BASE_URL/oauth/token"

derive_session_key() {
  python - <<'PY'
import os, re, urllib.parse
u=os.environ.get("BASE_URL","http://localhost:3000")
p=urllib.parse.urlparse(u)
host=(p.hostname or "local").replace(".","_")
port=f"_{p.port}" if p.port else ""
s=re.sub(r"[^a-zA-Z0-9_]+","_", host+port)
print(s or "local")
PY
}

SESSION_KEY="${OAUTH_SESSION_KEY:-}"
if [[ -z "$SESSION_KEY" ]]; then
  SESSION_KEY="$(derive_session_key)"
fi

TMP_DIR="scripts/.tmp"
mkdir -p "$TMP_DIR"

SESSION_JSON="$TMP_DIR/oauth_session.${SESSION_KEY}.json"
SESSION_ENV="$TMP_DIR/oauth.${SESSION_KEY}.env"
COOKIE_JAR="$TMP_DIR/oauth_cookiejar.${SESSION_KEY}.txt"
HEADERS_FILE="$TMP_DIR/oauth_headers.${SESSION_KEY}.txt"

seed_cookie_jar() {
  local jar_path="$1"
  local token="$2"
  python - "$jar_path" "$BASE_URL" "$token" <<'PY'
import sys, urllib.parse
jar_path = sys.argv[1]
base_url = sys.argv[2]
token = sys.argv[3]
parsed = urllib.parse.urlparse(base_url)
domain = parsed.hostname or "localhost"
secure = "TRUE" if parsed.scheme == "https" else "FALSE"
with open(jar_path, "w", encoding="utf-8") as fh:
    fh.write("# Netscape HTTP Cookie File\n")
    fh.write("\t".join([domain, "TRUE", "/", secure, "0", "sb-access-token", token]) + "\n")
PY
}

read_session_field() {
  local key="$1"
  [[ -f "$SESSION_JSON" ]] || { echo ""; return 0; }
  python - "$SESSION_JSON" "$key" <<'PY'
import json,sys
path=sys.argv[1]
key=sys.argv[2]
try:
  data=json.load(open(path,"r",encoding="utf-8"))
except Exception:
  data={}
v=data.get(key,"")
print("" if v is None else v)
PY
}

write_session() {
  local access_token="$1"
  local refresh_token="$2"
  local expires_in="$3"
  local now; now="$(now_epoch)"

  local exp="$now"
  if [[ -n "$expires_in" ]]; then
    exp=$(( now + expires_in - 30 ))
  else
    exp=$(( now + 900 - 30 ))
  fi

  python - "$SESSION_JSON" "$BASE_URL" "$CLIENT_ID" "$REDIRECT_URI" "$access_token" "$refresh_token" "$exp" "$now" <<'PY'
import json,sys
path=sys.argv[1]
base_url=sys.argv[2]
client_id=sys.argv[3]
redirect_uri=sys.argv[4]
access_token=sys.argv[5]
refresh_token=sys.argv[6]
access_expires_at=int(sys.argv[7])
updated_at=int(sys.argv[8])

sess={
  "base_url": base_url,
  "client_id": client_id,
  "redirect_uri": redirect_uri,
  "access_token": access_token,
  "refresh_token": refresh_token,
  "access_expires_at": access_expires_at,
  "updated_at": updated_at,
}
with open(path,"w",encoding="utf-8") as f:
  json.dump(sess,f,indent=2,sort_keys=True)
PY

  cat >"$SESSION_ENV" <<EOF
export BASE_URL="${BASE_URL}"
export CLIENT_ID="${CLIENT_ID}"
export REDIRECT_URI="${REDIRECT_URI}"
export ACCESS_TOKEN="${access_token}"
export REFRESH_TOKEN="${refresh_token}"
EOF

  chmod 600 "$SESSION_JSON" "$SESSION_ENV" 2>/dev/null || true
}

print_exports() {
  local access_token="$1"
  local refresh_token="$2"
  cat <<EOF
export BASE_URL="${BASE_URL}"
export CLIENT_ID="${CLIENT_ID}"
export REDIRECT_URI="${REDIRECT_URI}"
export ACCESS_TOKEN="${access_token}"
export REFRESH_TOKEN="${refresh_token}"
EOF
}

supabase_password_grant() {
  require_env SUPABASE_URL
  require_env SUPABASE_ANON_KEY
  require_env TEST_USER_EMAIL
  require_env TEST_USER_PASSWORD

  info "Supabase password grant -> sb-access-token"
  local supabase_json
  supabase_json=$(curl -sS \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" \
    "$SUPABASE_URL/auth/v1/token?grant_type=password")

  local sb
  sb="$(json_get "$supabase_json" "access_token")"
  [[ -n "$sb" ]] || { echo "$supabase_json" >&2; fail "Failed to get Supabase access_token"; }
  echo "$sb"
}

authorize_code_with_cookie() {
  local sb_access_token="$1"
  rm -f "$COOKIE_JAR" "$HEADERS_FILE"
  seed_cookie_jar "$COOKIE_JAR" "$sb_access_token"

  local code="" location=""
  for _ in 1 2; do
    curl -sS -D "$HEADERS_FILE" -o /dev/null -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
      "$AUTHZ_URL?response_type=code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&state=$STATE" \
      || true

    location="$(grep -i '^location:' "$HEADERS_FILE" | tail -n 1 | sed -E 's/^location:\s*//I' | tr -d '\r' || true)"
    if [[ -n "$location" ]]; then
      code="$(extract_code_from_url "$location")"
      [[ -n "$code" ]] && { echo "$code"; return 0; }
    fi
  done

  echo "Last headers:" >&2
  cat "$HEADERS_FILE" >&2 || true
  fail "Failed to obtain code from authorize redirect"
}

exchange_code_for_tokens() {
  local code="$1"
  info "Token exchange (authorization_code)"
  local token_json
  token_json=$(curl -sS -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&code=$code" \
    "$TOKEN_URL")

  local access refresh expires
  access="$(json_get "$token_json" "access_token")"
  refresh="$(json_get "$token_json" "refresh_token")"
  expires="$(json_get "$token_json" "expires_in")"

  [[ -n "$access" ]] || { echo "$token_json" >&2; fail "Token exchange missing access_token"; }
  [[ -n "$refresh" ]] || { echo "$token_json" >&2; fail "Token exchange missing refresh_token"; }

  write_session "$access" "$refresh" "${expires:-}"
  pass "Session updated via authorization_code"
}

refresh_access_token() {
  local refresh_token="$1"
  info "Refreshing access token"
  local refresh_json
  refresh_json=$(curl -sS -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=refresh_token&client_id=$CLIENT_ID&refresh_token=$refresh_token" \
    "$TOKEN_URL")

  local access expires
  access="$(json_get "$refresh_json" "access_token")"
  expires="$(json_get "$refresh_json" "expires_in")"

  [[ -n "$access" ]] || { echo "$refresh_json" >&2; return 1; }

  local new_refresh
  new_refresh="$(json_get "$refresh_json" "refresh_token")"
  [[ -n "$new_refresh" ]] || new_refresh="$refresh_token"

  write_session "$access" "$new_refresh" "${expires:-}"
  pass "Session refreshed"
}

ensure_session() {
  curl -sS -o /dev/null "$BASE_URL/" || fail "Server not reachable at $BASE_URL"

  local access refresh exp now
  access="$(read_session_field "access_token")"
  refresh="$(read_session_field "refresh_token")"
  exp="$(read_session_field "access_expires_at")"
  now="$(now_epoch)"

  if [[ -n "$access" && -n "$exp" && "$exp" -gt $(( now + 60 )) ]]; then
    return 0
  fi

  if [[ -n "$refresh" ]]; then
    refresh_access_token "$refresh" && return 0
  fi

  info "No valid session found; performing non-interactive login (Supabase password grant)"
  local sb code
  sb="$(supabase_password_grant)"
  code="$(authorize_code_with_cookie "$sb")"
  exchange_code_for_tokens "$code"
}

cmd_export() {
  # stdout MUST be exports only
  LOG_FD=2
  ensure_session
  local access refresh
  access="$(read_session_field "access_token")"
  refresh="$(read_session_field "refresh_token")"
  [[ -n "$access" && -n "$refresh" ]] || fail "No token in session after ensure"
  print_exports "$access" "$refresh"
}

cmd_ensure() {
  ensure_session
  pass "Session ready (key=$SESSION_KEY, files: $SESSION_JSON, $SESSION_ENV)"
}

cmd_print_env() {
  [[ -f "$SESSION_ENV" ]] || fail "No env file at $SESSION_ENV. Run: scripts/oauth_session.sh ensure"
  cat "$SESSION_ENV"
}

cmd_clear() {
  rm -f \
    "$SESSION_JSON" \
    "$SESSION_ENV" \
    "$COOKIE_JAR" \
    "$HEADERS_FILE"
  pass "Cleared session files (key=$SESSION_KEY)"
}

case "${1:-}" in
  export) cmd_export ;;
  ensure) cmd_ensure ;;
  print-env) cmd_print_env ;;
  clear) cmd_clear ;;
  *)
    echo "Usage:"
    echo "  $0 export             # ensure tokens; print exports to stdout (for eval)"
    echo "  $0 ensure             # ensure tokens; human-friendly logs"
    echo "  $0 print-env          # print persisted env file"
    echo "  $0 clear              # clear persisted session for this key"
    exit 2
    ;;
esac
