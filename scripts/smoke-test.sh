#!/usr/bin/env bash
# ==============================================================================
# PulseDNS Docker Container Smoke Test & Runtime Verification
# Tests fresh startup, container restart, and upgrade from pre-migration database
# ==============================================================================
set -euo pipefail

IMAGE_NAME="${1:-pulsedns:local-test}"
HOST_PORT="${2:-3055}"
CONTAINER_NAME="pulsedns-smoke-${HOST_PORT}"
TEST_DATA_DIR="/tmp/pulsedns-smoke-data-${HOST_PORT}"
MAX_RETRIES=30
RETRY_INTERVAL=1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "========================================================"
echo "Starting PulseDNS Comprehensive Container Smoke Test"
echo "Image: ${IMAGE_NAME}"
echo "Port: ${HOST_PORT}"
echo "Container: ${CONTAINER_NAME}"
echo "Data Dir: ${TEST_DATA_DIR}"
echo "========================================================"

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

docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

# ------------------------------------------------------------------------------
# TEST 1: Fresh Database Volume Startup
# ------------------------------------------------------------------------------
echo ""
echo ">>> [TEST 1] Testing fresh database volume startup..."
rm -rf "${TEST_DATA_DIR}"
mkdir -p "${TEST_DATA_DIR}"

echo ">>> Launching container with fresh volume..."
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

echo ">>> Polling health endpoint http://localhost:${HOST_PORT}/api/health..."
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
  sleep "${RETRY_INTERVAL}"
done

if [ "${HEALTHY}" -ne 1 ]; then
  echo "ERROR: Container failed to become healthy on fresh startup."
  docker logs "${CONTAINER_NAME}"
  exit 1
fi

# Verify root page (no login redirect)
ROOT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/" || true)
if [ "${ROOT_CODE}" = "200" ]; then
  echo ">>> Root page loaded immediately without login redirect (HTTP 200)"
else
  echo "ERROR: Root page returned unexpected HTTP status: ${ROOT_CODE}"
  docker logs "${CONTAINER_NAME}"
  exit 1
fi

# Verify dashboard stats endpoint
STATS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/api/dashboard/stats" || true)
if [ "${STATS_CODE}" = "200" ]; then
  echo ">>> Dashboard stats API verified accessible (HTTP 200)"
else
  echo "ERROR: Dashboard API returned unexpected HTTP status: ${STATS_CODE}"
  docker logs "${CONTAINER_NAME}"
  exit 1
fi

# Verify /api/auth/me is removed (HTTP 404)
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/api/auth/me" || true)
if [ "${AUTH_CODE}" = "404" ]; then
  echo ">>> /api/auth/me confirmed absent (HTTP 404)"
else
  echo "WARNING: /api/auth/me returned HTTP ${AUTH_CODE}"
fi

# ------------------------------------------------------------------------------
# TEST 2: Container Restart & Migration Idempotency
# ------------------------------------------------------------------------------
echo ""
echo ">>> [TEST 2] Testing container restart & migration idempotency..."
docker restart "${CONTAINER_NAME}"

RESTART_HEALTHY=0
for i in $(seq 1 "${MAX_RETRIES}"); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/api/health" || true)
  if [ "${HTTP_CODE}" = "200" ]; then
    echo ">>> Restart health check succeeded on attempt ${i} (HTTP 200)"
    RESTART_HEALTHY=1
    break
  fi
  sleep "${RETRY_INTERVAL}"
done

if [ "${RESTART_HEALTHY}" -ne 1 ]; then
  echo "ERROR: Container failed healthcheck after restart."
  docker logs "${CONTAINER_NAME}"
  exit 1
fi
echo ">>> Container restart verified successfully."

# Stop and remove container for Test 3
docker stop "${CONTAINER_NAME}" >/dev/null 2>&1
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1

# ------------------------------------------------------------------------------
# TEST 3: Upgrade Migration from Pre-Migration Database (with User & Session rows)
# ------------------------------------------------------------------------------
echo ""
echo ">>> [TEST 3] Testing upgrade migration from pre-migration database..."
rm -rf "${TEST_DATA_DIR}"
mkdir -p "${TEST_DATA_DIR}"

# Seed pre-migration database with legacy User and Session data
if [ -f "${REPO_DIR}/backups/pulsedns_pre_migration.db" ]; then
  echo ">>> Seeding test volume with pre-migration database..."
  cp "${REPO_DIR}/backups/pulsedns_pre_migration.db" "${TEST_DATA_DIR}/pulsedns.db"
else
  echo ">>> Creating synthetic pre-migration database..."
  sqlite3 "${TEST_DATA_DIR}/pulsedns.db" "
    CREATE TABLE User (id TEXT PRIMARY KEY, username TEXT, passwordHash TEXT, createdAt DATETIME, updatedAt DATETIME);
    INSERT INTO User VALUES ('u1', 'admin', 'hash', datetime('now'), datetime('now'));
    CREATE TABLE Session (id TEXT PRIMARY KEY, userId TEXT, token TEXT, expiresAt DATETIME, createdAt DATETIME);
    INSERT INTO Session VALUES ('s1', 'u1', 'tok1', datetime('now'), datetime('now'));
    CREATE TABLE ApplicationSettings (id TEXT PRIMARY KEY DEFAULT 'default', dashboardName TEXT DEFAULT 'PulseDNS', timezone TEXT DEFAULT 'UTC', defaultTheme TEXT DEFAULT 'dark', defaultInterval INTEGER DEFAULT 300, ipv4SourceUrls TEXT DEFAULT '', ipv6SourceUrls TEXT DEFAULT '', requestTimeoutSec INTEGER DEFAULT 10, maxRetries INTEGER DEFAULT 3, workerHeartbeat DATETIME, updatedAt DATETIME);
    INSERT INTO ApplicationSettings (id, dashboardName, updatedAt) VALUES ('default', 'PulseDNS', datetime('now'));
  "
fi

echo ">>> Launching container with pre-migration volume..."
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

UPGRADE_HEALTHY=0
for i in $(seq 1 "${MAX_RETRIES}"); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/api/health" || true)
  if [ "${HTTP_CODE}" = "200" ]; then
    echo ">>> Upgrade health check succeeded on attempt ${i} (HTTP 200)"
    UPGRADE_HEALTHY=1
    break
  fi
  sleep "${RETRY_INTERVAL}"
done

if [ "${UPGRADE_HEALTHY}" -ne 1 ]; then
  echo "ERROR: Container failed to start on pre-migration database upgrade."
  echo ">>> Dumping container logs:"
  docker logs "${CONTAINER_NAME}"
  exit 1
fi

# Verify container logs do NOT contain prisma data loss warning
CONTAINER_LOGS=$(docker logs "${CONTAINER_NAME}" 2>&1)
if echo "${CONTAINER_LOGS}" | grep -qi "accept-data-loss"; then
  echo "ERROR: Container startup emitted Prisma data-loss warning!"
  echo "${CONTAINER_LOGS}"
  exit 1
fi
echo ">>> Confirmed: No '--accept-data-loss' warnings emitted during startup."

# Verify that legacy tables were preserved in SQLite
if command -v sqlite3 >/dev/null 2>&1; then
  LEGACY_USERS=$(sqlite3 "${TEST_DATA_DIR}/pulsedns.db" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='_legacy_User';" 2>/dev/null || echo "0")
  if [ "${LEGACY_USERS}" = "1" ]; then
    LEGACY_USER_COUNT=$(sqlite3 "${TEST_DATA_DIR}/pulsedns.db" "SELECT count(*) FROM _legacy_User;" 2>/dev/null || echo "0")
    echo ">>> Data preservation verified: _legacy_User exists with ${LEGACY_USER_COUNT} rows."
  fi
fi

echo "========================================================"
echo "PulseDNS All Smoke Tests PASSED SUCCESSFULLY!"
echo "========================================================"
exit 0
