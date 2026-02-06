#!/bin/sh
set -e

# Run database migrations (SAFE - preserves data)
echo "Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "Starting Next.js server..."
exec "$@"
