#!/usr/bin/env bash
# One-command local install (SPEC §13.4). Safe to run again: it only does what is still missing,
# then rebuilds, so it also applies an update after `git pull`.
set -euo pipefail
cd "$(dirname "$0")"

usage() {
  cat <<'TXT'
Usage: ./setup.sh [--yes] [--skip-models] [--lan]
  --yes          accept the defaults without asking (no sample students)
  --skip-models  don't download AI models
  --lan          let ./start.sh serve phones on the same Wi-Fi by default
TXT
}

YES=0
SKIP_MODELS=0
LAN=0
for arg in "$@"; do
  case "$arg" in
    -y | --yes) YES=1 ;;
    --skip-models) SKIP_MODELS=1 ;;
    --lan) LAN=1 ;;
    -h | --help) usage && exit 0 ;;
    *) echo "Unknown option: $arg" && usage && exit 2 ;;
  esac
done

step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok() { printf '  ✓ %s\n' "$1"; }
warn() { printf '  ! %s\n' "$1"; }

# Sets KEY=VALUE in .env.local, replacing the line if it's there (works with BSD and GNU tools).
set_env() {
  local tmp
  tmp=$(mktemp)
  if grep -q "^$1=" .env.local; then
    awk -v k="$1" -v v="$2" -F= '$1 == k { print k "=" v; next } { print }' .env.local >"$tmp"
  else
    cat .env.local >"$tmp"
    printf '%s=%s\n' "$1" "$2" >>"$tmp"
  fi
  mv "$tmp" .env.local
}

# A value from .env.local, without an inline comment, or empty.
env_value() {
  local line
  line=$(grep -E "^$1=" .env.local 2>/dev/null | tail -n 1) || true
  printf '%s' "${line#*=}" | sed -e 's/[[:space:]]#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

step "1. Node.js"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "  Node.js isn't installed. Download it from https://nodejs.org/en/download (version 22 or newer), then run ./setup.sh again."
  exit 1
fi
need=$(node -p "require('./package.json').engines.node.match(/\d+/)[0]")
have=$(node -p "process.versions.node.split('.')[0]")
if [ "$have" -lt "$need" ]; then
  echo "  This laptop has Node.js $(node -v); TuitionSetu needs version $need or newer: https://nodejs.org/en/download"
  exit 1
fi
ok "Node.js $(node -v)"

step "2. AI engine (Ollama)"
OLLAMA_URL=$(env_value OLLAMA_HOST)
OLLAMA_URL=${OLLAMA_URL:-http://127.0.0.1:11434}
if ! command -v ollama >/dev/null 2>&1; then
  echo "  Ollama isn't installed. Download it from https://ollama.com/download, open it once, then run ./setup.sh again."
  exit 1
fi
ollama_up() { curl -sf "$OLLAMA_URL/api/version" >/dev/null 2>&1; }
if ! ollama_up; then
  echo "  Starting Ollama…"
  (ollama serve >/dev/null 2>&1 &)
  for _ in $(seq 1 20); do ollama_up && break; sleep 0.5; done
fi
if ollama_up; then
  ok "Ollama is running at $OLLAMA_URL"
else
  warn "Ollama didn't answer at $OLLAMA_URL. Open the Ollama app; models are skipped for now."
  SKIP_MODELS=1
fi

step "3. Packages"
if [ -f node_modules/.package-lock.json ] && [ node_modules/.package-lock.json -nt package-lock.json ]; then
  ok "Already installed"
else
  npm ci --no-audit --no-fund --loglevel=error
  ok "Installed"
fi

step "4. Settings"
FIRST_RUN=0
if [ -f .env.local ]; then
  ok ".env.local is already there; it's left as it is"
else
  cp .env.example .env.local
  set_env APP_MODE local
  FIRST_RUN=1
  ok "Created .env.local (models and other settings live here)"
fi
if [ "$LAN" = 1 ]; then
  set_env LISTEN_ON_LAN true
  ok "./start.sh will serve phones on your Wi-Fi"
fi

step "5. AI models"
if [ "$SKIP_MODELS" = 1 ]; then
  warn "Skipped. The setup wizard shows any missing model and the command to get it."
else
  case "$(uname -s)" in
    Darwin) bytes=$(sysctl -n hw.memsize) ;;
    *) bytes=$(awk '/MemTotal/ { print $2 * 1024 }' /proc/meminfo) ;;
  esac
  gb=$((bytes / 1073741824))
  ok "This laptop has $gb GB of memory"
  [ "$gb" -lt 8 ] && warn "Below 8 GB, writing updates may be slow."
  npx tsx --conditions=react-server scripts/models.ts | while IFS=$'\t' read -r name size; do
    if ollama show "$name" >/dev/null 2>&1; then
      ok "$name is installed"
    else
      echo "  Downloading $name${size:+ ($size GB)}. This happens once and can take a while."
      ollama pull "$name" || warn "Couldn't download $name. The setup wizard shows the command to try again."
    fi
  done
fi

step "6. Database"
npm run --silent db:migrate

step "7. Sample students"
# Asked once, on the first run: the answer lives in .env.local (SEED_SAMPLE, IMPL D-25).
if [ "$FIRST_RUN" = 0 ]; then
  ok "Already answered: SEED_SAMPLE=$(env_value SEED_SAMPLE) in .env.local"
elif [ "$YES" = 1 ]; then
  ok "Skipped (--yes). Add your own students in the setup wizard."
else
  read -r -p "  Add sample students to try it out? [y/N] " answer || answer=""
  if [[ "$answer" =~ ^[Yy] ]]; then
    set_env SEED_SAMPLE true
    ok "Six fictional students are added when you finish the setup wizard"
  else
    set_env SEED_SAMPLE false
    ok "No sample students"
  fi
fi

step "8. Build"
log=$(mktemp)
if ! npm run --silent build >"$log" 2>&1; then
  cat "$log"
  echo "  The build failed (above). Nothing else was changed."
  exit 1
fi
rm -f "$log"
ok "Built"

step "Done"
echo "  Start TuitionSetu with ./start.sh, then open http://localhost:3000"
echo "  For your phone on the same Wi-Fi: ./start.sh --lan"
