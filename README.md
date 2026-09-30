<p align="center">
  <img src="public/logo.svg" alt="SnowShare logo" width="120" />
</p>

<h1 align="center">SnowShare</h1>

<p align="center">
  <a href="https://hub.docker.com/r/turodev/snowshare"><img src="https://img.shields.io/docker/pulls/turodev/snowshare?logo=docker&label=Docker%20Hub" alt="Docker pulls" /></a>
  <a href="https://github.com/TuroYT/snowshare/releases"><img src="https://img.shields.io/github/v/release/TuroYT/snowshare" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/TuroYT/snowshare" alt="License" /></a>
</p>

SnowShare is a self-hosted app for sharing files, links and pastes. You run it on your own server, and anyone you send a link to can open it, with or without an account depending on how you set it up.

## What it does

- Files: uploads are resumable (tus), so a dropped connection doesn't restart a 20 GB transfer. Several files can go in one share, and common formats are previewed in the browser.
- Links: a URL shortener with optional custom slugs.
- Pastes: text or code with syntax highlighting.

Any share can have an expiration date, a maximum number of views, a password and a QR code.

On the admin side you get user accounts (email/password or OAuth), optional email verification and CAPTCHA, separate quotas for anonymous and logged-in users, custom branding, and a choice between local disk and S3-compatible storage. There is also a REST API with API keys. The interface is translated into English, French, Spanish, German, Dutch and Polish.

## Install with Docker

The image is on Docker Hub as [`turodev/snowshare`](https://hub.docker.com/r/turodev/snowshare), built for amd64 and arm64. Database migrations run when the container starts, so there is nothing to do by hand.

### Docker Compose

Create a folder with this `docker-compose.yml` in it:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: snowshare
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    image: turodev/snowshare:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/snowshare
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      ALLOW_SIGNUP: "true"
    ports:
      - "3000:3000"
    volumes:
      - uploads:/app/uploads

volumes:
  db-data:
  uploads:
```

Then generate a `.env` file next to it and start everything:

```bash
cat > .env <<EOF
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
EOF

docker compose up -d
```

Replace `NEXTAUTH_URL` with your real URL if the instance is not only used locally. Open http://localhost:3000 and create the first account: it becomes the admin.

### Plain docker run

If you'd rather not use Compose:

```bash
docker network create snowshare-net

docker run -d \
  --name snowshare-db \
  --network snowshare-net \
  --restart unless-stopped \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=snowshare \
  -v snowshare-db:/var/lib/postgresql/data \
  postgres:16-alpine

docker run -d \
  --name snowshare \
  --network snowshare-net \
  --restart unless-stopped \
  -p 3000:3000 \
  -e DATABASE_URL="postgres://postgres:change-me@snowshare-db:5432/snowshare" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  -e ALLOW_SIGNUP="true" \
  -v snowshare-uploads:/app/uploads \
  turodev/snowshare:latest
```

Write the generated `NEXTAUTH_SECRET` down. It signs sessions and download tokens, so if you recreate the container with a different one, everybody gets logged out.

### Tags

`latest` follows the newest release. You can also pin a minor (`1.5`) or an exact version (`1.5.4`).

### Updating

```bash
docker compose pull
docker compose up -d
```

With `docker run`, pull the new image, remove the `snowshare` container and start it again with the same command. Your data lives in the volumes, not in the container.

It's worth dumping the database before a big version jump:

```bash
docker compose exec db pg_dump -U postgres snowshare > snowshare-backup.sql
```

Other install methods are covered in [docs/UPGRADE.md](docs/UPGRADE.md).

## Configuration

Four variables are required:

| Variable          | Description                                       |
| ----------------- | ------------------------------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string                      |
| `NEXTAUTH_URL`    | Public URL of the instance                        |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`)         |
| `ALLOW_SIGNUP`    | `true` or `false`, whether new users can register |

The rest is optional:

| Variable                     | Default     | Description                                                           |
| ---------------------------- | ----------- | --------------------------------------------------------------------- |
| `AUTH_TRUST_HOST`            |             | Set to `true` behind a reverse proxy                                  |
| `TRUSTED_PROXY_COUNT`        | `1`         | Number of reverse proxies in front of SnowShare                       |
| `PORT`                       | `3000`      | Port the server listens on                                            |
| `UPLOAD_DIR`                 | `./uploads` | Absolute path for local file storage, ignored when `S3_BUCKET` is set |
| `S3_BUCKET`                  |             | Setting it switches file storage to S3                                |
| `S3_REGION`                  | `us-east-1` |                                                                       |
| `S3_ACCESS_KEY_ID`           |             |                                                                       |
| `S3_SECRET_ACCESS_KEY`       |             |                                                                       |
| `S3_ENDPOINT`                |             | For S3-compatible services (MinIO, Garage, R2...)                     |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `en`        | Fallback language: `en`, `fr`, `es`, `de`, `nl` or `pl`               |
| `TELEMETRY`                  | `true`      | `false` turns analytics off                                           |
| `PLAUSIBLE_DOMAIN`           |             | Use your own Plausible site                                           |
| `PLAUSIBLE_HOST`             |             | URL of your own Plausible instance                                    |

Quotas, anonymous sharing, OAuth providers, SMTP, CAPTCHA, branding and S3 can also be changed from the admin panel, no restart needed.

### Reverse proxy

Set `NEXTAUTH_URL` to the public HTTPS URL and add `AUTH_TRUST_HOST=true`.

SnowShare needs the real client IP for quotas, rate limiting and access logs. It reads it from `X-Forwarded-For`, and `TRUSTED_PROXY_COUNT` tells it how many proxies to skip from the right. The default of `1` fits a single nginx, Traefik or Caddy. Use `2` for something like Cloudflare in front of nginx, and `0` if the app is exposed directly (forwarding headers are then ignored).

File uploads go through `/api/tus`. If big uploads fail, check that the proxy isn't limiting the request body size (`client_max_body_size 0;` on nginx).

### Where the data is

Uploaded files are in `/app/uploads` unless you use S3, and the database is in the Postgres volume. Those are the two things to back up. Expired shares are deleted every hour.

## API

The REST API lives under `/api/v1` and uses API keys, which you create from your profile page. Each instance serves its own docs at `/api-docs`, and the OpenAPI spec at `/api/v1/openapi.json`.

## Development

You need Node.js 24 or newer and a PostgreSQL database.

```bash
git clone https://github.com/TuroYT/snowshare
cd snowshare
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Edit `.env` before running the migration. The dev server listens on http://localhost:3000.

To build the image from source instead of pulling it, run `docker compose up -d --build` from the repository.

Commands you'll use most:

```bash
npm run lint
npm run type-check
npm test
npx prisma studio
```

`make help` lists a few more shortcuts.

The stack is Next.js 16 (App Router), React 19, TypeScript, Prisma with PostgreSQL, NextAuth.js and TailwindCSS 4. `server.js` is a small custom server that wraps Next.js to handle tus uploads. Pages and API routes are in `src/app`, shared logic (auth, storage, quotas, share access) in `src/lib`, and translations in `src/i18n/locales`.

## Contributing

Pull requests are welcome. Have a look at [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first. For security issues, see [SECURITY.md](SECURITY.md).

## Telemetry

SnowShare sends anonymous usage statistics to [Plausible](https://plausible.io/): no cookies, no personal data. Set `TELEMETRY=false` to turn it off, or use `PLAUSIBLE_DOMAIN` and `PLAUSIBLE_HOST` to send the data to your own Plausible instance.

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=TuroYT/snowshare&type=date&legend=top-left)](https://www.star-history.com/#TuroYT/snowshare&type=date&legend=top-left)

## License

[CC0 1.0 Universal](LICENSE)
