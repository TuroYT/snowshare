# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SnowShare is a secure file/link/paste sharing platform. Users can share URLs (LinkShare), text/code snippets (PasteShare), and files (FileShare) with optional expiration, password protection, custom slugs, and QR codes.

**Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Prisma (PostgreSQL) + NextAuth.js (JWT strategy) + TailwindCSS 4 + MUI

## Commands

```bash
npm run dev              # Dev server with tus uploads (custom server.js, port 3000)
npm run build            # prisma generate + next build --webpack
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm test                 # Jest (jsdom)
npm test -- --testPathPattern="<pattern>"  # Run single test file
npm run test:watch       # Jest watch mode
npm run test:coverage    # Jest coverage
npx prisma migrate dev --name <name>  # Create migration
npx prisma generate      # Regenerate client to src/generated/prisma/
npx prisma studio        # DB GUI
npm run cleanup:expired  # Remove expired shares
docker compose up -d --build  # Alternative: full stack (Next.js + PostgreSQL)
```

**Required env vars** (`.env`): `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `ALLOW_SIGNUP`.

## Architecture

### Custom Server (`server.js`)

A Node.js HTTP server (run with `tsx`) wraps Next.js to add **tus protocol** support for resumable file uploads at `/api/tus`. It authenticates (NextAuth JWT or API key), enforces the per-user size limit (`maxSize`) and IP quota, validates share options and stores the uploader context in the upload metadata (survives restarts), then creates the share and moves the file from `uploads/.tus-temp/` to storage (local or S3) via `src/lib/upload-share.ts`. It imports TypeScript modules from `src/lib` directly (tsx resolves `./src/lib/x.js` to `x.ts`). It also sets the `x-snowshare-client-ip` header for Next.js routes, runs the hourly cleanup (`scripts/cleanup-expired-shares.ts`) and shuts down gracefully.

### Route Structure (App Router)

- `src/app/(shares)/f|l|p/[slug]/` — Display shares by type (File/Link/Paste)
- `src/app/api/shares/route.ts` — Create link/paste shares (via `src/lib/shares.ts`, shared with `/api/v1`)
- `src/app/api/upload/`, `src/app/api/v1/upload/` — Multipart file uploads (streamed to disk)
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth handler
- `src/app/admin/`, `src/app/profile/`, `src/app/setup/` — Admin panel, user profile, first-run setup

### Authentication

- NextAuth with CredentialsProvider + dynamic OAuth providers (configured in DB `OAuthProvider` table)
- JWT strategy: `token.id` and `token.name` synced to session via callbacks in `src/lib/auth.ts`
- `getAuthOptions()` returns dynamic options (with OAuth); static `authOptions` export for middleware only
- First registered user becomes admin automatically
- Setup flow: middleware redirects to `/setup` if no users exist

```typescript
// Standard auth check in API routes:
const session = await getServerSession(authOptions);
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### Share Creation Flow

All share types: validate input → check quota (IP-based, `src/lib/quota-shared.ts`) → optional auth → hash password (bcrypt cost 12) → generate/validate slug (`/^[a-zA-Z0-9_-]{3,30}$/`) → store in DB → return `{ share: { slug, ... } }`. Never return raw share rows: use `toPublicShare()` / `toUserShare()` (no password hash, uploader IP or storage key).

### Share Access Flow

`src/lib/share-access.ts` holds the rules for reading a share: `checkShareAvailability()` (expiration, view limit), `verifySharePassword()` (rate limited per IP + share), `consumeView()` (atomic, never exceeds `maxViews`) and signed download tokens (`createDownloadToken()` / `verifyDownloadToken()`, HMAC with `NEXTAUTH_SECRET`, bound to the client IP, 15 min). The file page asks `POST /f/<slug>/api {action:"download"}` once (one view) and reuses the token for downloads and previews; any file request without a `download` token consumes a view. Files are streamed with Range support by `streamStoredFile()` (`src/lib/file-response.ts`).

Anonymous users: max 7-day expiration, lower quotas. Files stored as `{shareId}_{originalName}` in `uploads/`.

### Key Services

| File                                                     | Purpose                                                                                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/prisma.ts`                                      | Singleton PrismaClient (one per process, shared with server.js)                                                                                      |
| `src/lib/auth.ts`                                        | NextAuth config with dynamic OAuth, login rate limit, account linking                                                                                |
| `src/lib/quota-shared.ts`                                | Upload limits and IP quota (SQL aggregates over `Share.size`)                                                                                        |
| `src/lib/settings.ts`                                    | `getSettingsCached()` (30 s cache) — call `invalidateSettingsCache()` after any Settings write; never send the raw row to clients (it holds secrets) |
| `src/lib/share-access.ts`                                | Share access rules, view counting, download tokens                                                                                                   |
| `src/lib/rate-limit.ts`                                  | In-memory rate limiter (`RATE_LIMITS`, 429 + Retry-After)                                                                                            |
| `src/lib/getClientIp.ts`                                 | Client IP (`x-snowshare-client-ip` from server.js, `TRUSTED_PROXY_COUNT`)                                                                            |
| `src/lib/storage.ts`                                     | Local/S3 storage (cached S3 client, multipart uploads, `deleteShareFiles`)                                                                           |
| `src/lib/upload-share.ts`, `src/lib/multipart-upload.ts` | Upload validation/share creation, streaming multipart receiver                                                                                       |
| `src/proxy.ts`                                           | Security headers, setup redirect (cached), route protection                                                                                          |

### Database

PostgreSQL via Prisma. Schema at `prisma/schema.prisma`, generated client at `src/generated/prisma/`. Key models: `User`, `Share` (FILE|PASTE|URL), `ShareFile` (bulk uploads), `Settings` (quotas, branding, theming), `OAuthProvider`.

### i18n

- **Client-side**: i18next with 6 locales (`src/i18n/locales/`: en, fr, es, de, nl, pl). Auto-detected + localStorage. Use `t("section.key", "English default")`.
- **Server-side (API routes)**: `src/lib/i18n-server.ts` provides `getT(request)` which returns a synchronous `t()` function. Locale is resolved from `?lang=` query param, cookies (`i18next`, `i18nextLng`, `NEXT_LOCALE`), or `Accept-Language` header.
- **API error/success messages are translated** — use `t("key")` from `getT(request)` in API routes, not hardcoded English strings.
- **Add keys to all 6 locale files** when adding any user-facing text (client or API).

## Key files for common tasks

| Task                | Files                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Add API endpoint    | `src/app/api/<name>/route.ts`                                                                 |
| Modify auth         | `src/lib/auth.ts`, `src/app/api/auth/register/route.ts`                                       |
| Add share type      | `src/lib/shares.ts` + `src/app/api/shares/route.ts` + display at `src/app/(shares)/<prefix>/` |
| Add UI component    | `src/components/`                                                                             |
| Add translation key | All 6 files in `src/i18n/locales/*.json`                                                      |
| Change quotas       | `prisma/schema.prisma` Settings model + `src/lib/quota-shared.ts`                             |

## Conventions

- **Imports**: Always use `@/` alias (e.g., `import { prisma } from "@/lib/prisma"`), never relative `../`
- **Prisma imports**: Types from `@/generated/prisma`, client from `@/lib/prisma`
- **Client components**: Mark with `"use client"`, use `useTranslation()` for text, `useSession()` for auth
- **API responses**: Success: `{ share: {...} }` / `{ data: [...] }`. Error: `{ error: "message" }` with proper HTTP status (400/401/403/409/429), message is translated using i18n
- **Styling**: TailwindCSS 4 + `src/components/ui` components, mobile-first
- **State**: Simple `useState`, no external state libraries
- **Slug validation**: `/^[a-zA-Z0-9_-]{3,30}$/`
- **Passwords**: bcryptjs with cost 12
- **Tests**: `npm test` includes a locale parity test — every key and `{{placeholder}}` must exist in all 6 locales
- **Error handling in non-blocking paths**: Never use empty `catch {}` blocks. Always log with `console.error("context:", error)` even in fire-and-forget paths (e.g. `logShareAccess`) so failures are observable.
