# Upgrade guide

How to move a SnowShare instance to a newer version, depending on how you installed it.

The admin panel tells you when a new release is out, with your current version, the latest one and a link to the release notes. Read those notes before upgrading: anything that needs manual action is listed there and in [Behaviour changes](#behaviour-changes) below.

## Before you start

Back up the database and, if you store files locally, the uploads.

With Docker:

```bash
docker compose exec db pg_dump -U postgres snowshare > backup_$(date +%Y%m%d).sql
docker compose cp app:/app/uploads ./uploads_backup_$(date +%Y%m%d)
```

Without Docker:

```bash
pg_dump -U postgres snowshare > backup_$(date +%Y%m%d).sql
cp -r uploads/ uploads_backup_$(date +%Y%m%d)/
```

## Upgrading

### Docker Hub image

This is the setup described in the [README](../README.md#install-with-docker), where `docker-compose.yml` uses `image: turodev/snowshare`.

```bash
docker compose pull
docker compose up -d
```

Database migrations run when the new container starts.

If you pinned a version (`turodev/snowshare:1.5.4`), change the tag in `docker-compose.yml` first. With `latest` or a minor tag like `1.5`, `pull` is enough.

With `docker run` instead of Compose:

```bash
docker pull turodev/snowshare:latest
docker rm -f snowshare
```

Then start the container again with the same `docker run` command as before, including the same `NEXTAUTH_SECRET`.

### Docker, built from source

If you cloned the repository and build the image yourself:

```bash
cd /path/to/snowshare
git pull origin main
docker compose up -d --build
```

Migrations also run on startup here.

### Manual installation

Node.js 24 or newer is required.

```bash
cd /path/to/snowshare
git pull origin main
npm install
npx prisma migrate deploy
npm run build
```

Then restart the app with whatever manages it, for example `pm2 restart snowshare` or `systemctl restart snowshare`.

### Proxmox LXC

If you can't log in after an update, the `.env` file was probably overwritten. Restore it from the container's console:

```bash
cd /opt/snowshare && cp ../snowshare.env .env && reboot
```

## After the upgrade

Check the logs (`docker compose logs -f app`), open the web interface, and make sure an existing share still opens and that you can create a new one. If the UI looks broken, clear your browser cache first.

## Rolling back

A newer version may have changed the database schema, and migrations are not reverted automatically. The safe way back is to restore the database backup you made before upgrading, then start the old version.

Docker Hub image: set the previous tag in `docker-compose.yml` (for example `turodev/snowshare:1.5.3`) and run `docker compose up -d`.

Built from source or manual installation:

```bash
git checkout v1.5.3   # your previous version
```

Then rebuild as in the upgrade steps above (`docker compose up -d --build`, or `npm install && npm run build` and a restart).

## Troubleshooting

### The container doesn't start

```bash
docker compose logs -f app
```

Most of the time the cause is in the first lines: a failed migration or a missing environment variable. If you build from source and suspect a stale layer, rebuild without cache:

```bash
docker compose build --no-cache
docker compose up -d
```

### Migration errors

```bash
npx prisma migrate status
```

With Docker, prefix it with `docker compose exec app`. The output shows which migration failed.

Do not run `npx prisma migrate reset` on a real instance: it drops every table and all your data.

### Build errors (manual installation)

Start again from a clean tree:

```bash
rm -rf .next node_modules
npm install
npm run build
```

## Behaviour changes

Changes that can affect an existing instance. The full changelog is on the [releases page](https://github.com/TuroYT/snowshare/releases).

### Security and performance audit

- Client IP: SnowShare now uses the last `X-Forwarded-For` entry (the one added by your reverse proxy) instead of the first, which clients could forge to get around quotas. Nothing changes with a single reverse proxy. If several proxies are chained (Cloudflare → nginx → SnowShare), set `TRUSTED_PROXY_COUNT` to their number. If SnowShare is exposed directly with no proxy, set `TRUSTED_PROXY_COUNT=0` so forwarding headers sent by clients are ignored.
- API keys are hashed with HMAC-SHA256 keyed with `NEXTAUTH_SECRET`. Keys created with a recent release could not authenticate; recreate them from your profile if needed. Changing `NEXTAUTH_SECRET` invalidates every API key, and every session as before. A client that sends too many invalid keys now gets a `429` instead of being treated as anonymous.
- View limits: download links built by the share page use a short-lived signed `token` instead of `?password=`. Direct downloads without a token (`/f/<slug>/download`, `/api/download/<slug>`, bulk ZIP and individual bulk files) count one view per request, Range requests included, so `maxViews` can no longer be bypassed. `?password=` is still accepted.
- Anonymous file uploads now follow the "allow anonymous file sharing" admin setting on every upload endpoint.
- Profile: changing your email address requires your current password (for password accounts), and a new verification email when email verification is enabled.
- Database: a nullable `Share.size` column and some indexes are added automatically. No data is modified.
- Docker: the image has a `HEALTHCHECK`. The unused `/var/log` volume was removed from `docker-compose.yml`, and expired shares are now cleaned up inside the app every hour (the old cron script is gone).

## Getting help

Look through the [open issues](https://github.com/TuroYT/snowshare/issues) first. If nothing matches, open a new one with the version you came from, the version you upgraded to, the error messages or logs, and your setup (Docker or manual, OS, Node version).
