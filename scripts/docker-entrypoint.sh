#!/bin/sh
set -e

# 1. Ensure /app/data directory exists and has correct ownership for node user
if [ -d "/app/data" ]; then
  chown -R node:node /app/data 2>/dev/null || true
  chmod 775 /app/data 2>/dev/null || true
fi

# 2. Synchronize database schema if using SQLite
if [ -n "$DATABASE_URL" ]; then
  echo ">>> [PulseDNS Entrypoint] Synchronizing database schema ($DATABASE_URL)..."
  if command -v su-exec >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
    su-exec node npx prisma db push --skip-generate
  else
    npx prisma db push --skip-generate
  fi
fi

# 3. Drop root privileges to node user if running as root
if command -v su-exec >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
  echo ">>> [PulseDNS Entrypoint] Dropping privileges to user node and launching: $@"
  exec su-exec node "$@"
else
  echo ">>> [PulseDNS Entrypoint] Launching application process: $@"
  exec "$@"
fi
