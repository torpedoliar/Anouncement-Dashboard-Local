#!/bin/sh
set -e

# Run database migrations
echo "Running database migrations..."
npx prisma db push --accept-data-loss

# Start the application
echo "Starting Next.js server..."
exec "$@"
