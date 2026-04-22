#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
    # Running as root: drop to snowshare user
    su -s /bin/sh snowshare -c "npx prisma generate && npx prisma migrate deploy"
    exec su -s /bin/sh snowshare -c "npx tsx server.js"
else
    # Already running as non-root user (e.g. via docker-compose user:), run directly
    npx prisma generate && npx prisma migrate deploy
    exec npx tsx server.js
fi
