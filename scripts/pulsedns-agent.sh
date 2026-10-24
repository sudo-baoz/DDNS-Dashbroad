#!/usr/bin/env bash
# ==============================================================================
# PulseDNS Reference Agent - Lightweight Bash Client
# Reports current public IP to your self-hosted PulseDNS Dashboard.
# ==============================================================================
set -euo pipefail

PULSEDNS_URL="${PULSEDNS_URL:-http://localhost:3000}"
AGENT_TOKEN="${AGENT_TOKEN:-}"
CHECK_IPV6="${CHECK_IPV6:-false}"

if [ -z "$AGENT_TOKEN" ]; then
  echo "Error: AGENT_TOKEN environment variable is required." >&2
  echo "Usage: AGENT_TOKEN='pulse_xxx' PULSEDNS_URL='https://ddns.example.com' $0" >&2
  exit 1
fi

echo "[PulseDNS Agent] Detecting public IP..."

if [ "$CHECK_IPV6" = "true" ]; then
  DETECTED_IP=$(curl -s -m 5 https://api6.ipify.org || curl -s -m 5 https://ipv6.icanhazip.com || true)
else
  DETECTED_IP=$(curl -s -m 5 https://api.ipify.org || curl -s -m 5 https://icanhazip.com || curl -s -m 5 https://ifconfig.me/ip || true)
fi

if [ -z "$DETECTED_IP" ]; then
  echo "[PulseDNS Agent] Could not detect outbound public IP. Relying on PulseDNS server detection."
  PAYLOAD="{}"
else
  echo "[PulseDNS Agent] Detected IP: $DETECTED_IP"
  PAYLOAD="{\"ip\": \"$DETECTED_IP\"}"
fi

echo "[PulseDNS Agent] Sending update to $PULSEDNS_URL/api/agent/update..."

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$PULSEDNS_URL/api/agent/update" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP_BODY=$(echo "$RESPONSE" | sed -e '/HTTP_STATUS:/d')
HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "[PulseDNS Agent] Success! $HTTP_BODY"
  exit 0
else
  echo "[PulseDNS Agent] Failed with HTTP $HTTP_STATUS: $HTTP_BODY" >&2
  exit 1
fi
