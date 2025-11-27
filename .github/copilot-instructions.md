<!-- Copilot / AI agent instructions for the SnowShare repository -->

# Quick orientation

- **Stack**: Next.js 15 (App Router) + React 19 + TypeScript + Prisma + NextAuth + TailwindCSS 4
- **Structure**: `src/app/` (App Router), `src/components/`, `src/lib/` utilities
- **Database**: PostgreSQL + Prisma; schema at `prisma/schema.prisma`, generated client at `src/generated/prisma`
- **i18n**: Client-side i18next with 4 locales (fr/en/es/de) in `src/i18n/locales/`

# Architecture & data flow

```
┌─ src/app/
│  ├─ (shares)/f|l|p/[slug]  → Share display pages (File/Link/Paste)
│  ├─ api/shares/            → Create shares (routes to linkshare.ts, pasteshareshare.ts, fileshare.ts)
│  ├─ api/auth/              → NextAuth handler + /register endpoint
│  └─ api/admin|settings|quota → Admin & config APIs
├─ src/lib/
│  ├─ auth.ts                → NextAuth config (CredentialsProvider + JWT)
│  ├─ prisma.ts              → Singleton PrismaClient
│  └─ quota.ts               → Upload quota enforcement by IP
└─ uploads/                  → Local file storage (dev)
```

**Core models** (`prisma/schema.prisma`): `User` (with `password` + `isAdmin`), `Share` (FILE|PASTE|URL), `Settings` (quotas, signup toggle)

# Authentication system (critical)

- **Provider**: `CredentialsProvider` in `src/lib/auth.ts` — passwords hashed with `bcryptjs` (cost 12)
- **Session**: JWT strategy. Token contains `id` and `name`; access via `session.user.id` in callbacks
- **First user**: Auto-promoted to admin (`isAdmin: true`) via `src/app/api/auth/register/route.ts`
- **Signup control**: Database `Settings.allowSignin` field (not env var). Check via `/api/setup/check`
- **Protected routes**: Middleware in `src/middleware.ts` guards `/dashboard`, `/profile`, `/api/protected`

```typescript
// Getting session in API routes:
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
const session = await getServerSession(authOptions);
```

# Share creation patterns

All share types follow this pattern in `src/app/api/shares/`:
1. Validate input & check quotas (`src/lib/quota.ts`)
2. Hash password if provided (bcrypt)
3. Generate unique slug if not provided
4. Create Prisma record with `ownerId` (nullable for anon)
5. Return `{ share: ... }` or `{ error: "..." }`

**Anonymous restrictions**: Max 7-day expiration, must provide expiration date, lower quotas

# Developer commands

```bash
npm run dev          # Next.js dev with Turbopack
npm run build        # Production build
npm run lint:fix     # ESLint auto-fix
npm run cleanup:expired  # Remove expired shares (cron job)

npx prisma migrate dev --name <name>  # Create migration
npx prisma generate                    # Regenerate client → src/generated/prisma
```

**Docker**: `docker compose up -d --build` — runs `prisma migrate deploy` on startup

# Project conventions

- **API responses**: Always `{ error: "message" }` on failure, `{ share|user|message: ... }` on success
- **French error messages**: API errors are in French (e.g., "Email et mot de passe requis")
- **Prisma imports**: Use `import { prisma } from "@/lib/prisma"` and `import { ... } from "@/generated/prisma"`
- **Client components**: Mark with `"use client"` at top; use `useTranslation()` from react-i18next
- **Translations**: Add keys to all 4 locale files in `src/i18n/locales/` when adding UI text

# Key files for common tasks

| Task | Files |
|------|-------|
| Add API endpoint | `src/app/api/<name>/route.ts` — export `GET`/`POST`/etc |
| Modify auth | `src/lib/auth.ts` (callbacks), `src/app/api/auth/register/route.ts` |
| Add share type | `src/app/api/shares/`, new `(typeShare)/` folder |
| Add UI component | `src/components/` — check Navigation.tsx for patterns |
| Add translation | All files in `src/i18n/locales/*.json` |
| Change quotas | `prisma/schema.prisma` Settings model, `src/lib/quota.ts` |

# AI agent guidelines

- **⚠️ Migration caution**: Prisma migrations are irreversible in production. Test locally first.
- **⚠️ Auth changes**: JWT callbacks in `src/lib/auth.ts` must stay in sync — both `jwt` and `session`
- **Validate slugs**: Regex pattern `/^[a-zA-Z0-9_-]{3,30}$/` for share slugs
- **IP tracking**: File uploads track IP via `getClientIp()` in `src/lib/quota.ts` for quota enforcement
- **Setup flow**: First visit triggers setup check in middleware → redirects to `/setup` if no users exist

