#!/usr/bin/env bash
# ==============================================================================
# PulseDNS Docker Container Smoke Test & Runtime Verification
# ==============================================================================
set -euo pipefail

IMAGE_NAME="${1:-pulsedns:local-test}"
HOST_PORT="${2:-3055}"
CONTAINER_NAME="pulsedns-smoke-${HOST_PORT}"
TEST_DATA_DIR="/tmp/pulsedns-smoke-data-${HOST_PORT}"
MAX_RETRIES=30
RETRY_INTERVAL=1

echo "========================================================"
echo "Starting PulseDNS Container Smoke Test"
echo "Image: ${IMAGE_NAME}"
echo "Port: ${HOST_PORT}"
echo "Container: ${CONTAINER_NAME}"
echo "Data Dir: ${TEST_DATA_DIR}"
echo "========================================================"

# Prepare isolated data directory
rm -rf "${TEST_DATA_DIR}"
mkdir -p "${TEST_DATA_DIR}"

# Cleanup function on script exit
cleanup() {
  echo ""
  echo ">>> Cleaning up test container: ${CONTAINER_NAME}..."
  docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  rm -rf "${TEST_DATA_DIR}" >/dev/null 2>&1 || true
  echo ">>> Cleanup complete."
}
trap cleanup EXIT

# Clean up any leftover previous container with same name
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

# Run the container with volume mount and disposable, isolated test secrets
echo ">>> Launching container..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${HOST_PORT}:3000" \
  -v "${TEST_DATA_DIR}:/app/data" \
  -e PORT="3000" \
  -e HOSTNAME="0.0.0.0" \
  -e NODE_ENV="production" \
  -e ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  -e DATABASE_URL="file:/app/data/pulsedns.db" \
  -e ENABLE_WORKER="true" \
  "${IMAGE_NAME}"

echo ">>> Container started. Polling health endpoint http://localhost:${HOST_PORT}/api/health..."

HEALTHY=0
for i in $(seq 1 "${MAX_RETRIES}"); do
  HTTP_CODE=$(curl -s -o /tmp/health_response.json -w "%{http_code}" "http://localhost:${HOST_PORT}/api/health" || true)
  
  if [ "${HTTP_CODE}" = "200" ]; then
    echo ">>> Health check succeeded on attempt ${i} (HTTP 200)"
    cat /tmp/health_response.json
    echo ""
    HEALTHY=1
    break
  fi
  
  echo "Attempt ${i}/${MAX_RETRIES}: received HTTP ${HTTP_CODE}, waiting ${RETRY_INTERVAL}s..."
  sleep "${RETRY_INTERVAL}"
done

if [ "${HEALTHY}" -ne 1 ]; then
  echo "ERROR: Container failed to become healthy within $((MAX_RETRIES * RETRY_INTERVAL)) seconds."
  echo ">>> Dumping container logs:"
  docker logs "${CONTAINER_NAME}"
  exit 1
fi

# Verify root application page returns HTTP 200 directly (no login redirect)
echo ">>> Verifying root application page (HTTP GET http://localhost:${HOST_PORT}/)..."
ROOT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/" || true)

if [ "${ROOT_CODE}" = "200" ]; then
  echo ">>> Root page loaded immediately without login redirect (HTTP ${ROOT_CODE})"
else
  echo "ERROR: Root page returned unexpected HTTP status: ${ROOT_CODE} (expected 200)"
  docker logs "${CONTAINER_NAME}"
  exit 1
fi

# Verify unauthenticated API endpoint access works
echo ">>> Verifying dashboard stats endpoint (HTTP GET http://localhost:${HOST_PORT}/api/dashboard/stats)..."
STATS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/api/dashboard/stats" || true)

if [ "${STATS_CODE}" = "200" ]; then
  echo ">>> Dashboard API verified accessible without login (HTTP 200)"
else
  echo "ERROR: Dashboard API returned unexpected HTTP status: ${STATS_CODE}"
  docker logs "${CONTAINER_NAME}"
  exit 1
fi

# Verify /api/auth/me returns 404 (route completely removed)
echo ">>> Verifying /api/auth/me is removed..."
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/api/auth/me" || true)

if [ "${AUTH_CODE}" = "404" ]; then
  echo ">>> /api/auth/me successfully confirmed absent (HTTP 404)"
else
  echo "WARNING: /api/auth/me returned HTTP ${AUTH_CODE}"
fi

echo "========================================================"
echo "PulseDNS Container Smoke Test PASSED SUCCESSFULLY!"
echo "========================================================"
exit 0
