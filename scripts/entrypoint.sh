#!/bin/sh
set -e

# Run migrations as the snowshare user (no root needed for prisma)
su -s /bin/sh snowshare -c "npx prisma generate && npx prisma migrate deploy"

# Start crond as root (required to manage cron jobs)
crond

# Drop to non-root user and start the app
exec su -s /bin/sh snowshare -c "npx tsx server.js"
