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
```

## Architecture

### Custom Server (`server.js`)
A Node.js HTTP server wraps Next.js to add **tus protocol** support for resumable file uploads at `/api/tus`. It handles authentication via NextAuth JWT tokens, enforces per-IP upload quotas, validates slugs, and moves completed uploads from `.tus-temp/` to `uploads/`. Uses `AsyncLocalStorage` to pass request context (IP, auth) through tus callbacks.

### Route Structure (App Router)
- `src/app/(shares)/f|l|p/[slug]/` — Display shares by type (File/Link/Paste)
- `src/app/api/shares/(fileShare|linkShare|pasteShare)/route.ts` — Create shares
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth handler
- `src/app/admin/`, `src/app/profile/`, `src/app/setup/` — Admin panel, user profile, first-run setup

### Authentication
- NextAuth with CredentialsProvider + dynamic OAuth providers (configured in DB `OAuthProvider` table)
- JWT strategy: `token.id` and `token.name` synced to session via callbacks in `src/lib/auth.ts`
- `getAuthOptions()` returns dynamic options (with OAuth); static `authOptions` export for middleware
- First registered user becomes admin automatically
- Setup flow: middleware redirects to `/setup` if no users exist

### Share Creation Flow
All share types: validate input → check quota (IP-based, `src/lib/quota.ts`) → optional auth → hash password (bcrypt cost 12) → generate/validate slug (`/^[a-zA-Z0-9_-]{3,30}$/`) → store in DB → return `{ share: { slug, ... } }`

Anonymous users: max 7-day expiration, lower quotas. Files stored as `{shareId}_{originalName}` in `uploads/`.

### Key Services
| File | Purpose |
|------|---------|
| `src/lib/prisma.ts` | Singleton PrismaClient |
| `src/lib/auth.ts` | NextAuth config with dynamic OAuth |
| `src/lib/quota.ts` | Upload quota enforcement by IP/user |
| `src/lib/settings.ts` | App settings from DB |
| `src/middleware.ts` | Security headers, setup redirect, route protection |

### Database
PostgreSQL via Prisma. Schema at `prisma/schema.prisma`, generated client at `src/generated/prisma/`. Key models: `User`, `Share` (FILE|PASTE|URL), `ShareFile` (bulk uploads), `Settings` (quotas, branding, theming), `OAuthProvider`.

### i18n
- **Client-side**: i18next with 6 locales (`src/i18n/locales/`: en, fr, es, de, nl, pl). Auto-detected + localStorage. Use `t("section.key", "English default")`.
- **Server-side (API routes)**: `src/lib/i18n-server.ts` provides `getT(request)` which returns a synchronous `t()` function. Locale is resolved from `?lang=` query param, cookies (`i18next`, `i18nextLng`, `NEXT_LOCALE`), or `Accept-Language` header.
- **API error/success messages are translated** — use `t("key")` from `getT(request)` in API routes, not hardcoded English strings.
- **Add keys to all 6 locale files** when adding any user-facing text (client or API).

## Conventions

- **Imports**: Always use `@/` alias (e.g., `import { prisma } from "@/lib/prisma"`), never relative `../`
- **Prisma imports**: Types from `@/generated/prisma`, client from `@/lib/prisma`
- **Client components**: Mark with `"use client"`, use `useTranslation()` for text, `useSession()` for auth
- **API responses**: Success: `{ share: {...} }` / `{ data: [...] }`. Error: `{ error: "message" }` with proper HTTP status (400/401/403/409/429), message is translated using i18n
- **Styling**: TailwindCSS 4 + MUI components, mobile-first
- **State**: Simple `useState`, no external state libraries
- **Slug validation**: `/^[a-zA-Z0-9_-]{3,30}$/`
- **Passwords**: bcryptjs with cost 12
