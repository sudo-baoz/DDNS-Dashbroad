#!/bin/sh
set -e

# Automatically apply database schema if using SQLite
if [ -n "$DATABASE_URL" ]; then
  echo ">>> [PulseDNS Entrypoint] Synchronizing database schema ($DATABASE_URL)..."
  npx prisma db push --skip-generate || echo ">>> [PulseDNS Entrypoint] Warning: prisma db push returned non-zero, continuing startup..."
fi

echo ">>> [PulseDNS Entrypoint] Launching application process: $@"
exec "$@"
