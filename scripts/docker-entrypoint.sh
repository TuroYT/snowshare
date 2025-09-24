#!/bin/sh
set -e

echo "🐳 Starting SnowShare Docker container..."

# Ensure data directory exists
mkdir -p /app/data
mkdir -p /app/uploads

# Set proper permissions
chown -R nextjs:nodejs /app/data /app/uploads 2>/dev/null || true

echo "📁 Data directories created"

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

echo "🚀 Starting SnowShare application..."
exec "$@"