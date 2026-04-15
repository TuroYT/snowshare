<p align="center">
   <img src="public/logo.svg" alt="SnowShare Logo" width="120" style="margin-bottom: 10px;" />
</p>

<h1 align="center" style="font-family: 'Segoe UI', Arial, sans-serif; color: #3b82f6; font-size: 2.5rem; margin-bottom: 0.5em;">SnowShare</h1>

<p align="center" style="font-size: 1.15rem; color: #374151; font-weight: 500; margin-bottom: 1.5em;">
   SnowShare is a modern, <b>secure</b> file and link sharing platform built with Next.js, Prisma, and NextAuth.<br>
   It provides a clean, user-friendly interface for sharing URLs, text snippets, and files with customizable options for expiration, privacy, and access.
</p>

## Features ✨

### LinkShare 🔗

- Share any URL with a customizable shortened link
- Set expiration times (1 day to solar explosion) ⏳
- Option for no expiration (authenticated users)
- Custom slugs for personalized links
- Password protection for enhanced security 🔒
- Instant QR code generation for shared links 📱

### PasteShare 📋

- Share code snippets and text with syntax highlighting 🎨
- Support for multiple programming languages
- Expiration options and password protection 🔒
- Ideal for sharing code samples, configuration files, or any text content

### FileShare 📁

- Secure file uploads with size limits
- Automatic file type detection
- Download tracking 📥
- Same expiration and protection features

### User Management 👥

- User registration and authentication via NextAuth 🔑

- **Frontend**: Next.js 16, React 19.1, TailwindCSS 4
- **Authentication**: NextAuth.js with bcrypt password hashing
- **Special Features**: QR code generation, custom URL slugs

## Getting Started 🚀

- Node.js 24+ and npm/yarn
- PostgreSQL database

### Prerequisites ✅

- Node.js 24+ and npm/yarn
- PostgreSQL database

- Node.js 24+ and npm/yarn
- PostgreSQL database

### Installation 🛠️

1. Clone the repository

   ```
   git clone https://github.com/TuroYT/snowshare
   cd snowshare
   ```

2. Install dependencies

   ```
   npm install
   ```

3. Set up environment variables
   Create a `.env` file in the root directory with the following variables:

   ```
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/snowshare"

   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key"

   # Auth (allow or disallow user signups)
   ALLOW_SIGNUP=true
   ```

## Docker

### Quick start (Docker Hub)

The easiest way to run SnowShare — no build needed, PostgreSQL included.

#### Option A — docker-compose (recommended)

1. Create a `docker-compose.yml`:

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
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
      DATABASE_URL: postgres://postgres:postgres@db:5432/snowshare
      NEXTAUTH_URL: http://localhost:3000        # Change to your public URL
      NEXTAUTH_SECRET: changeme-replace-with-random-secret  # Change this!
      ALLOW_SIGNUP: "true"
    ports:
      - "3000:3000"
    volumes:
      - uploads:/app/uploads

volumes:
  db-data:
  uploads:
```

2. Start the stack:

```bash
docker compose up -d
```

#### Option B — docker run

Start PostgreSQL first:

```bash
docker run -d \
  --name snowshare-db \
  --network snowshare-net \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=snowshare \
  -v snowshare-db:/var/lib/postgresql/data \
  postgres:16-alpine
```

Then start SnowShare:

```bash
docker network create snowshare-net

docker run -d \
  --name snowshare \
  --network snowshare-net \
  -p 3000:3000 \
  -e DATABASE_URL="postgres://postgres:postgres@snowshare-db:5432/snowshare" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  -e ALLOW_SIGNUP="true" \
  -v snowshare-uploads:/app/uploads \
  turodev/snowshare:latest
```

---

The app will be available at http://localhost:3000.

> **Note:** Change `NEXTAUTH_URL` to your public domain and use a strong `NEXTAUTH_SECRET` (generate one with `openssl rand -base64 32`).

Available tags: `latest`, `1.3.9`, `1.3`

### Build from source

```bash
docker compose up -d --build
```

4. Initialize the database

   ```
   npx prisma migrate dev
   ```

5. Start the development server

   ```
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure 🗂️

```
/
├── prisma/                # Prisma schema and migrations
├── public/                # Static assets
└── src/
    ├── app/               # Next.js App Router structure
    │   ├── api/           # API routes
    │   ├── auth/          # Authentication pages
    │   ├── protected/     # Protected slugs and shares
    │   └── s/             # Short link redirects
    ├── components/        # React components
    ├── hooks/             # Custom React hooks
    └── lib/               # Utility functions and shared code
```

## 🙏 Acknowledgments

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License ⚖️

This project is licensed under the MIT License - see the LICENSE file for details.

## Privacy & Analytics 🔒

SnowShare uses [Plausible Analytics](https://plausible.io/) for privacy-friendly, cookie-free usage statistics. Plausible is:

- **GDPR compliant** — No personal data collected
- **Cookie-free** — No consent banner needed
- **Open source** — Transparent and auditable

No personally identifiable information is collected. Analytics help us understand usage patterns to improve the project.

**To disable telemetry**, add to your `.env`:

```env
TELEMETRY=false
```

**To use your own Plausible instance**:

```env
PLAUSIBLE_DOMAIN=your-domain.com
PLAUSIBLE_HOST=https://your-plausible-instance.com
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=TuroYT/snowshare&type=date&legend=top-left)](https://www.star-history.com/#TuroYT/snowshare&type=date&legend=top-left)

## Acknowledgments / Credits 🙌

- [Next.js](https://nextjs.org/) - The React Framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [NextAuth.js](https://next-auth.js.org/) - Authentication for Next.js
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework
