#!/usr/bin/env bash
# Starts TuitionSetu on this laptop (SPEC §3 Stage A). --lan also serves phones on the same Wi-Fi.
set -euo pipefail
cd "$(dirname "$0")"

LAN=0
for arg in "$@"; do
  case "$arg" in
    --lan) LAN=1 ;;
    -h | --help) echo "Usage: ./start.sh [--lan]" && exit 0 ;;
    *) echo "Unknown option: $arg. Usage: ./start.sh [--lan]" && exit 2 ;;
  esac
done

env_value() {
  local line
  line=$(grep -E "^$1=" .env.local 2>/dev/null | tail -n 1) || true
  printf '%s' "${line#*=}" | sed -e 's/[[:space:]]#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

if [ ! -f .next/BUILD_ID ]; then
  echo "TuitionSetu isn't set up yet. Run ./setup.sh first."
  exit 1
fi
[ "$(env_value LISTEN_ON_LAN)" = "true" ] && LAN=1
PORT=${PORT:-3000}

# The AI engine: started here if it's installed but not running, so "open TuitionSetu" is all it takes (§4.3).
OLLAMA_URL=$(env_value OLLAMA_HOST)
OLLAMA_URL=${OLLAMA_URL:-http://127.0.0.1:11434}
ollama_up() { curl -sf "$OLLAMA_URL/api/version" >/dev/null 2>&1; }
if ! ollama_up && command -v ollama >/dev/null 2>&1; then
  echo "Starting the AI engine…"
  (ollama serve >/dev/null 2>&1 &)
  for _ in $(seq 1 20); do ollama_up && break; sleep 0.5; done
fi
ollama_up || echo "The AI engine isn't running. Notes are still saved and are read once you open the Ollama app."

if [ "$LAN" = 1 ]; then
  HOST=0.0.0.0
  echo "TuitionSetu: http://localhost:$PORT on this laptop"
  if ip=$(node scripts/lan-ip.mjs); then echo "On your phone (same Wi-Fi), open http://$ip:$PORT"; fi
else
  HOST=127.0.0.1
  echo "TuitionSetu: open http://localhost:$PORT"
fi
exec npx next start -H "$HOST" -p "$PORT"
