#!/bin/sh
set -e
echo "[docker-entrypoint] prisma migrate deploy..."
npx prisma migrate deploy
echo "[docker-entrypoint] demarrage Next.js sur 0.0.0.0:${PORT:-3000}..."
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
