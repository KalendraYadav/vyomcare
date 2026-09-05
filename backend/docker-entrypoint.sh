#!/bin/sh
set -e

# Run Prisma migrations automatically if DATABASE_URL is configured
if [ -n "$DATABASE_URL" ]; then
  echo "🚀 Running database migrations (prisma migrate deploy)..."
  npx prisma migrate deploy || {
    echo "⚠️ Warning: Prisma migration deploy encountered an issue, proceeding to application start..."
  }
fi

echo "🚀 Starting BioTrack NestJS application..."
exec "$@"
