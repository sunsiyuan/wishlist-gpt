#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

# Preserve runtime-controlled vars (do NOT let dotenv override these)
BASE_URL_SAVED="${BASE_URL-}"
OAUTH_SESSION_KEY_SAVED="${OAUTH_SESSION_KEY-}"
CLIENT_ID_SAVED="${CLIENT_ID-}"
REDIRECT_URI_SAVED="${REDIRECT_URI-}"
OAUTH_ALLOW_AUTH_HEADER_LOGIN_SAVED="${OAUTH_ALLOW_AUTH_HEADER_LOGIN-}"

load_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}

# Always load .env.local/.env as the source of truth for secrets/config
load_file "$REPO_ROOT/.env.local"
load_file "$REPO_ROOT/.env"

# Restore runtime vars if they were set by caller
if [[ -n "${BASE_URL_SAVED+x}" && -n "${BASE_URL_SAVED}" ]]; then export BASE_URL="$BASE_URL_SAVED"; fi
if [[ -n "${OAUTH_SESSION_KEY_SAVED+x}" && -n "${OAUTH_SESSION_KEY_SAVED}" ]]; then export OAUTH_SESSION_KEY="$OAUTH_SESSION_KEY_SAVED"; fi
if [[ -n "${CLIENT_ID_SAVED+x}" && -n "${CLIENT_ID_SAVED}" ]]; then export CLIENT_ID="$CLIENT_ID_SAVED"; fi
if [[ -n "${REDIRECT_URI_SAVED+x}" && -n "${REDIRECT_URI_SAVED}" ]]; then export REDIRECT_URI="$REDIRECT_URI_SAVED"; fi
if [[ -n "${OAUTH_ALLOW_AUTH_HEADER_LOGIN_SAVED+x}" && -n "${OAUTH_ALLOW_AUTH_HEADER_LOGIN_SAVED}" ]]; then
  export OAUTH_ALLOW_AUTH_HEADER_LOGIN="$OAUTH_ALLOW_AUTH_HEADER_LOGIN_SAVED"
fi

# Optional fallback: if someone uses NEXT_PUBLIC_* only, fill SUPABASE_* (fallback only, no override)
: "${SUPABASE_URL:=${NEXT_PUBLIC_SUPABASE_URL:-}}"
: "${SUPABASE_ANON_KEY:=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"
