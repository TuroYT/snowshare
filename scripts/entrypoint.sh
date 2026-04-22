#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
    # Running as root: start crond and drop to snowshare user
    crond
    su -s /bin/sh snowshare -c "npx prisma generate && npx prisma migrate deploy"
    exec su -s /bin/sh snowshare -c "npx tsx server.js"
else
    # Already running as non-root user (e.g. via docker-compose user:), run directly
    # Note: crond requires root and will not run in this mode
    npx prisma generate && npx prisma migrate deploy
    exec npx tsx server.js
fi
