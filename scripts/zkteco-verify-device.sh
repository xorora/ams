#!/usr/bin/env bash
# Verify ZKTeco ADMS connectivity: handshake, heartbeat, and test punch.
# Usage:
#   ./scripts/zkteco-verify-device.sh              # localhost:3000
#   ./scripts/zkteco-verify-device.sh --production # ams.xorora.com

set -euo pipefail

PRODUCTION=false
SN="${ZKTECO_DEVICE_SN:-PAS4261300498}"

for arg in "$@"; do
  case "$arg" in
    --production) PRODUCTION=true ;;
    --sn=*) SN="${arg#*=}" ;;
    -h | --help)
      echo "Usage: $0 [--production] [--sn=SERIAL]"
      exit 0
      ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"

read_env_value() {
  local key="$1"
  local line
  line=$(grep -E "^${key}=" "$ENV_FILE" | head -1 || true)
  [[ -z "$line" ]] && return 0
  local val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  val="${val%\'}"
  val="${val#\'}"
  printf -v "$key" '%s' "$val"
  export "$key"
}

if [[ -f "$ENV_FILE" ]]; then
  read_env_value ZKTECO_DEVICE_TOKEN
  read_env_value ZKTECO_DEVICE_SN
fi

if [[ "$PRODUCTION" == true ]]; then
  BASE="https://ams.xorora.com"
else
  BASE="${ZKTECO_VERIFY_BASE:-http://localhost:3000}"
fi

TOKEN="${ZKTECO_DEVICE_TOKEN:-}"
ENC_TOKEN=""
if [[ -n "$TOKEN" ]]; then
  ENC_TOKEN=$(ZKTECO_DEVICE_TOKEN="$TOKEN" python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["ZKTECO_DEVICE_TOKEN"], safe=""))')
fi

auth_query() {
  if [[ -n "$ENC_TOKEN" ]]; then
    echo "Stamp=${ENC_TOKEN}"
  fi
}

pass=0
fail=0

check() {
  local name="$1"
  local code="$2"
  local body="$3"
  if [[ "$code" == "200" ]]; then
    echo "✓ $name (HTTP $code)"
    pass=$((pass + 1))
  else
    echo "✗ $name (HTTP $code)"
    echo "  Response: ${body:0:200}"
    fail=$((fail + 1))
  fi
}

echo "ZKTeco ADMS verification"
echo "  Base URL: $BASE"
echo "  Device SN: $SN"
echo ""

# 1. Handshake
AUTH=$(auth_query)
PROBE="probe=1"
URL="${BASE}/iclock/cdata?SN=${SN}&options=all&${PROBE}"
[[ -n "$AUTH" ]] && URL="${URL}&${AUTH}"
RESP=$(curl -sS -w "\n__HTTP__:%{http_code}" -H "X-ZKTeco-Probe: 1" "$URL" || true)
BODY=$(echo "$RESP" | sed '/__HTTP__:/d')
CODE=$(echo "$RESP" | grep '__HTTP__:' | cut -d: -f2)
check "Handshake GET /iclock/cdata" "$CODE" "$BODY"
if [[ "$CODE" == "200" ]]; then
  echo "$BODY" | head -3 | sed 's/^/  /'
fi
echo ""

# 2. Heartbeat
URL="${BASE}/iclock/getrequest?SN=${SN}&${PROBE}"
[[ -n "$AUTH" ]] && URL="${URL}&${AUTH}"
RESP=$(curl -sS -w "\n__HTTP__:%{http_code}" -H "X-ZKTeco-Probe: 1" "$URL" || true)
BODY=$(echo "$RESP" | sed '/__HTTP__:/d')
CODE=$(echo "$RESP" | grep '__HTTP__:' | cut -d: -f2)
check "Heartbeat GET /iclock/getrequest" "$CODE" "$BODY"
if [[ -n "$BODY" && "$CODE" == "200" ]]; then
  echo "  Body: ${BODY:0:120}"
fi
echo ""

# 3. Test punch (skip on production unless explicitly allowed)
if [[ "$PRODUCTION" == true && "${ZKTECO_VERIFY_LIVE_PUNCH:-}" != "1" ]]; then
  echo "⊘ Test punch skipped on production (set ZKTECO_VERIFY_LIVE_PUNCH=1 to enable)"
else
  PUNCH_TIME=$(TZ="${ZKTECO_TIMEZONE:-Asia/Karachi}" date '+%Y-%m-%d %H:%M:%S')
  PUNCH_BODY=$'9999\t'"${PUNCH_TIME}"$'\t0\t1\t0\t0'
  URL="${BASE}/iclock/cdata?SN=${SN}&table=ATTLOG&${PROBE}"
  [[ -n "$AUTH" ]] && URL="${URL}&${AUTH}"
  RESP=$(curl -sS -w "\n__HTTP__:%{http_code}" -X POST -H "X-ZKTeco-Probe: 1" "$URL" \
    -H "Content-Type: text/plain" \
    --data-binary "$PUNCH_BODY" || true)
  BODY=$(echo "$RESP" | sed '/__HTTP__:/d')
  CODE=$(echo "$RESP" | grep '__HTTP__:' | cut -d: -f2)
  check "Test punch POST /iclock/cdata (ATTLOG)" "$CODE" "$BODY"
  if [[ "$CODE" == "200" ]]; then
    echo "  Ingested: $BODY punch(es) at $PUNCH_TIME PKT"
  fi
fi
echo ""

echo "Results: $pass passed, $fail failed"
if [[ "$fail" -gt 0 ]]; then
  if [[ "$PRODUCTION" == true && "$CODE" == "404" ]]; then
    echo ""
    echo "Hint: HTTP 404 on production means /iclock routes are not deployed yet."
    echo "Deploy the ZKTeco ADMS changes to Vercel, then re-run with --production."
  elif [[ "$PRODUCTION" == true && "$CODE" == "403" ]]; then
    echo ""
    if [[ -z "$TOKEN" ]]; then
      echo "Hint: HTTP 403 — ZKTECO_DEVICE_TOKEN is not set in .env.local."
      echo "Add the same value as Vercel Production → Settings → Environment Variables."
    else
      echo "Hint: HTTP 403 — Stamp does not match production ZKTECO_DEVICE_TOKEN."
      echo "Copy the Vercel Production value into .env.local and on the K40 Stamp field."
    fi
  fi
  exit 1
fi
