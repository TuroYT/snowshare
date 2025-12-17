<!-- Copilot / AI agent instructions for the SnowShare repository -->

# Quick orientation

**SnowShare**: Secure file/link/paste sharing platform with user auth, quotas, and expiration.

- **Stack**: Next.js 15 (App Router) + React 19 + TypeScript + Prisma + NextAuth.js + TailwindCSS 4, PostgreSQL
- **Key paths**: `src/app/` (routes), `src/components/` (UI), `src/lib/` (utilities), `src/i18n/` (i18n)
- **Database**: PostgreSQL via Prisma; schema at `prisma/schema.prisma`, client at `src/generated/prisma/`
- **i18n**: Client-side i18next, 4 locales (fr/en/es/de), auto-detected + localStorage cache

# Architecture & data flow

```
Routes (App Router):
  (shares)/f|l|p/[slug]/page.tsx  → Display share by slug (File/Link/Paste)
  api/shares/(fileShare|linkShare|pasteShare)/route.ts → Create shares
  api/auth/[...nextauth]/route.ts → NextAuth handler
  api/setup/check, /admin, /profile, /quota/...  → Config & user APIs

Core services:
  src/lib/auth.ts      → NextAuth: CredentialsProvider + JWT (token: {id, name})
  src/lib/quota.ts     → Enforce upload limits by IP/user
  src/lib/prisma.ts    → Singleton PrismaClient
  src/middleware.ts    → Security headers, setup redirect, route protection
```

**Models** (`prisma/schema.prisma`):
- `User` (auth): email, password (bcrypt), isAdmin, shares
- `Share` (core): type (FILE|PASTE|URL), slug, password, expiresAt, ipSource, owner
- `Settings`: allowSignup, quotas (fileMax, totalMax)
- `Account`, `Session`, `VerificationToken` (NextAuth)

# Authentication system (critical)

- **Provider**: CredentialsProvider (`src/lib/auth.ts`) — email/password, bcrypt hashing (cost 12)
- **Strategy**: JWT with callbacks sync `token.id` + `token.name` to session
- **Session access**: `const session = await getServerSession(authOptions)` in API routes
- **First user auto-admin**: Registered via `/api/auth/register` → `isAdmin: true` (no admins yet)
- **Signup toggle**: Database `Settings.allowSignup` (checked via `/api/setup/check`). Respects `NEXT_PUBLIC_ALLOW_SIGNUP` env
- **Protected routes**: Middleware in `src/middleware.ts` redirects unauthenticated users from `/profile`, `/admin`, protected APIs
- **Session module**: Extend with `interface User { id, name? }` and `interface JWT { id, name? }` in `src/lib/auth.ts`

```typescript
// API route: check auth & get user ID
const session = await getServerSession(authOptions);
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// Now use session.user.id
```

# Share creation flow

All shares (File/Link/Paste) follow this pattern in `src/app/api/shares/(shareType)/route.ts`:
1. **Validate**: Input schema, URL format (links), file size (files)
2. **Check quota**: `checkUploadQuota(request, fileSize)` → tracks by IP + user
3. **Auth check**: Extract session; set `ownerId` if authenticated (null for anon)
4. **Hash password**: If provided, use `bcryptjs` cost 12
5. **Generate slug**: Unique, alphanumeric/hyphen/underscore, 3-30 chars (or use provided)
6. **Store**: Create `Share` record (files stored in `uploads/` with filename: `{uuid}_{originalName}`)
7. **Return**: `{ share: { slug, expiresAt, ... } }` or `{ error: "..." }`

**Anonymous limits** (`src/lib/quota.ts`):
- Max 7-day expiration (must set expiration)
- Lower file/total quotas vs authenticated users
- IP-based tracking (no session ID)

# Developer commands

```bash
npm run dev          # Next.js dev with Turbopack (default: port 3000)
npm run build        # Production build (output: .next/)
npm run lint:fix     # ESLint auto-fix

npm run test         # Jest unit tests (jsdom environment)
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report

npm run cleanup:expired  # Remove expired shares (tsx script)

npx prisma migrate dev --name <name>  # Create + apply migration
npx prisma generate                    # Regenerate client → src/generated/prisma/
npx prisma db seed                     # Run prisma/seed.ts (if exists)
```

**Docker**: `docker compose up -d --build` — runs Next.js + PostgreSQL, executes `prisma migrate deploy` on startup. App at http://localhost:3000, DB at port 5432. Volumes: `db-data/` (persistent), `uploads/` (files).

**Environment vars** (`.env` or `docker-compose.yml`):
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: Base URL (http://localhost:3000)
- `NEXTAUTH_SECRET`: Random JWT secret (use `openssl rand -base64 32`)
- `ALLOW_SIGNUP`: Boolean (controls `Settings.allowSignup`, exported as `NEXT_PUBLIC_ALLOW_SIGNUP`)
- `PORT`: Dev server port (default 3000)

# Project conventions

## API responses
Always return JSON with consistent structure:
- **Success**: `{ share: {...} }`, `{ user: {...} }`, `{ message: "..." }`, `{ data: [...] }`
- **Error**: `{ error: "message" }` with appropriate HTTP status (400, 401, 403, 409, 429, etc.)

## Imports
- **Prisma**: `import { prisma } from "@/lib/prisma"` and `import { ... } from "@/generated/prisma"`
- **Paths**: Always use `@/` alias, never relative imports like `../../../`

## Client components
- Mark with `"use client"` at top of file
- Use `useTranslation()` from react-i18next for all UI text
- Access auth with `useSession()` from next-auth/react, or `useAuth()` hook
- State management: simple `useState` (no Redux/Zustand)

## Translations
- Add keys to ALL 4 locale files in `src/i18n/locales/` when adding UI text
- Fallback language is French (`fr`)
- Pattern: `t("section.key", "French default")`

## Styling
- TailwindCSS 4 and material ui
- Component library: React Material UI
- Responsive: Mobile-first approach

## File uploads
- Store in `uploads/` directory with pattern: `{uuid}_{originalName}` (uuid via crypto)
- Track file path in `Share.filePath` (relative to project root)
- Clean up files when shares expire (via cleanup script)

# Key files for common tasks

| Task | Files |
|------|-------|
| Add API endpoint | `src/app/api/<name>/route.ts` — export `GET`/`POST`/etc |
| Modify auth | `src/lib/auth.ts` (callbacks), `src/app/api/auth/register/route.ts` |
| Add share type | `src/app/api/shares/`, new `(typeShare)/` folder + display at `src/app/(shares)/` |
| Add UI component | `src/components/` — check Navigation.tsx for client/server patterns |
| Add translation | All files in `src/i18n/locales/*.json` (fr, en, es, de) |
| Change quotas | `prisma/schema.prisma` Settings model, `src/lib/quota.ts` enforcement |
| Database operations | All at `src/app/api/` routes; client at `src/generated/prisma` |

# AI agent guidelines

- **⚠️ Migration caution**: Prisma migrations are irreversible in production. Test locally first.
- **⚠️ Auth changes**: JWT callbacks in `src/lib/auth.ts` must stay in sync — both `jwt` and `session` callbacks
- **Validate slugs**: Regex pattern `/^[a-zA-Z0-9_-]{3,30}$/` for share slugs
- **IP tracking**: File uploads track IP via `getClientIp()` in `src/lib/quota.ts` for quota enforcement
- **Setup flow**: First visit triggers setup check in middleware → redirects to `/setup` if no users exist
- **Testing**: Jest with jsdom environment; mocks in `src/__tests__/` follow file structure of src/
- **Error handling**: Always validate input before DB queries; return 400 (bad), 401 (auth), 403 (forbidden), 429 (quota)
- **Performance**: Use `next/image` for Image optimization; leverage Next.js caching and ISR where applicable

