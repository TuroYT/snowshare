# Upgrade Guide

This guide explains how to upgrade your SnowShare instance to the latest version.

## Important

If you cant connect after an update in ProxmoxLXC, try this in you container's console

```bash
cd /opt/snowshare && cp ../snowshare.env .env && reboot
```

## Version Check

SnowShare automatically checks for updates and displays a notification in the **Admin Panel** when a new version is available. The notification shows:
- Your current version
- The latest available version
- Links to release notes and this upgrade guide

## Upgrade Methods

### Docker Compose (Recommended)

If you're running SnowShare with Docker Compose:

```bash
# Navigate to your SnowShare directory
cd /path/to/snowshare

# Pull the latest changes
git pull origin main

# Rebuild and restart containers
docker compose down
docker compose up -d --build
```

The container will automatically run database migrations on startup.

### Manual Installation

If you installed SnowShare manually:

dont forget to have node.js 24+ installed

```bash
# Navigate to your SnowShare directory
cd /path/to/snowshare

# Pull the latest changes
git pull origin main

# Install dependencies
npm install

# Run database migrations
npx prisma migrate deploy

# Rebuild the application
npm run build

# Restart the application
# (depends on your process manager, e.g., pm2, systemd)
pm2 restart snowshare
# or
systemctl restart snowshare
```

## Pre-Upgrade Checklist

Before upgrading, ensure you:

1. **Backup your database**
   ```bash
   # PostgreSQL backup example
   pg_dump -U postgres snowshare > backup_$(date +%Y%m%d).sql
   ```

2. **Backup your uploads folder**
   ```bash
   cp -r uploads/ uploads_backup_$(date +%Y%m%d)/
   ```

3. **Check the release notes** for any breaking changes or migration steps

4. **Test in a staging environment** if possible

## Post-Upgrade Steps

After upgrading:

1. **Verify the application starts correctly**
   - Check the logs for any errors
   - Verify you can access the web interface

2. **Test core functionality**
   - Create a test share (file, link, paste)
   - Verify existing shares are accessible
   - Check admin panel access

3. **Clear browser cache** if you notice UI issues

## Rollback

If you need to rollback to a previous version:

### Docker Compose
```bash
# Revert to a specific version
git checkout v0.1.0  # Replace with your previous version tag
docker compose down
docker compose up -d --build
```

### Manual Installation
```bash
# Revert to a specific version
git checkout v0.1.0  # Replace with your previous version tag
npm install
npm run build
# Restart your process manager
```

⚠️ **Note**: Rolling back may require reversing database migrations manually if the new version added schema changes.

## Troubleshooting

### Migration Errors

If you encounter database migration errors:

```bash
# Check migration status
npx prisma migrate status

# Reset migrations (⚠️ This will delete all data!)
npx prisma migrate reset
```

### Build Errors

If the build fails after upgrade:

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Rebuild
npm run build
```

### Container Issues

If Docker containers fail to start:

```bash
# Check logs
docker compose logs -f app

# Rebuild without cache
docker compose build --no-cache
docker compose up -d
```

## Version History

Check the [GitHub Releases](https://github.com/TuroYT/snowshare/releases) page for:
- Complete changelog
- Breaking changes
- New features
- Bug fixes

## Getting Help

If you encounter issues during upgrade:

1. Check the [GitHub Issues](https://github.com/TuroYT/snowshare/issues) for known problems
2. Open a new issue with:
   - Your current version
   - Target version
   - Error messages/logs
   - Your environment (Docker/manual, OS, Node version)
