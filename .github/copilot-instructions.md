<!-- Copilot / AI agent instructions for the SnowShare repository -->

# Quick orientation (do this first)

- Project type: Next.js (App Router) + TypeScript + Prisma + NextAuth.
- Root layout: `src/app/` (App Router). Server and client components used; check `"use client"` at top of files to identify client components.
- Database: PostgreSQL with Prisma; schema in `prisma/schema.prisma`. Generated client lives at `src/generated/prisma`.

# High-level architecture

- Frontend and API are colocated under `src/app/`:
  - UI pages and components: `src/app/*`, `src/components/*`.
  - API routes: `src/app/api/*` (Next.js app-router style). Example: NextAuth handler at `src/app/api/auth/[...nextauth]/route.ts`.
- Authentication: NextAuth configured in `src/lib/auth.ts` using the PrismaAdapter and a CredentialsProvider. Session strategy: `jwt`.
- Persistence: Prisma models defined in `prisma/schema.prisma`. Important models: `User` (password hashed with bcryptjs), `Session`, `Account`, `Share`, `Settings`.
- File uploads: local uploads stored in `uploads/` for dev. Watch `src/app/(shares)/f/*` routes for file download handlers.

# How auth works (very important)

- NextAuth provider: `CredentialsProvider` (see `src/lib/auth.ts`). Passwords are hashed with `bcryptjs` and stored in `User.password`.
- Session strategy is JWT. The project adds `token.id` in the `jwt` callback and then sets `session.user.id` in the `session` callback. That means server-side code should rely on NextAuth session helpers where possible.
- The NextAuth route is exported from `src/app/api/auth/[...nextauth]/route.ts`.
- Signup is implemented at `src/app/api/auth/register/route.ts` and may enforce `ALLOW_SIGNUP` server-side (reads `process.env.ALLOW_SIGNUP`). The client signup page (`src/app/auth/signup/page.tsx`) calls `/api/auth/register` and then uses `next-auth/react`'s `signIn('credentials', ...)` to auto-login.

# Developer workflows & commands

- Local dev:
  - Install: `npm install`
  - Dev server: `npm run dev` (uses `next dev --turbopack`)
  - Build: `npm run build`
  - Start (production-like): `npm run start`
- Database / Prisma:
  - Generate client: `npx prisma generate` (generated client path: `src/generated/prisma`)
  - Create/migrate DB in dev: `npx prisma migrate dev`
  - In production, the README notes `prisma migrate deploy` runs on startup when using Docker.
- Linting: `npm run lint` and `npm run lint:fix`.
- Background cleanup script: `npm run cleanup:expired` (runs `scripts/cleanup-expired-shares.ts` via tsx).
- Docker: use `docker compose up -d --build` (README includes steps and `.env` guidance).

# Project-specific conventions & gotchas

- App Router everywhere — routes are under `src/app/` (not `pages/`). Remember middleware (`src/middleware.ts`) may be present.
- Prisma client is generated to a custom path. Import paths use `@/generated/prisma` (check `src/generated/prisma` if you regenerate).
- Environment flags:
  - `ALLOW_SIGNUP` (server) controls whether registration is allowed. Note the client also uses `NEXT_PUBLIC_ALLOW_SIGNUP` in the signup page — keep server and client behavior aligned when changing signup rules.
  - `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are required for NextAuth.
- Auth: Credentials provider + bcrypt hashing — do not attempt to replace sign-in behavior without updating `src/lib/auth.ts` and the prisma schema (User.password exists and is required for credentials provider).
- Session storage: JWT strategy — changes to session shape must update both `jwt` and `session` callbacks.

# Integration points & where to look

- NextAuth config: `src/lib/auth.ts` (adapter, providers, callbacks).
- Signup API: `src/app/api/auth/register/route.ts`.
- Sign-in page: `src/app/auth/signin/page.tsx` and signup page `src/app/auth/signup/page.tsx`.
- Prisma models & migrations: `prisma/schema.prisma` and `prisma/migrations/`.
- Generated client: `src/generated/prisma`.
- File share handlers: `src/app/(shares)/f/*` and `src/app/api/download/[slug]/route.ts`.

# Minimal examples for common changes

- To add a new API route (App Router): create `src/app/api/<name>/route.ts` and export handlers (e.g. `export { GET, POST }`). Follow the pattern used in `src/app/api/auth/register/route.ts`.
- To alter auth sign-in behavior: update `src/lib/auth.ts` callbacks and provider authorize methods. Example: CredentialsProvider.authorize returns `{ id, email, name }` on success.
- To add a new Prisma migration:
  1. Edit `prisma/schema.prisma`.
  2. Run `npx prisma migrate dev --name your_change`.
  3. Commit `prisma/migrations/*` and updated generated client (if needed).

# Notes for AI agents

- Be conservative with changes touching auth and prisma migration files. Migration changes affect the DB and are not reversible automatically.
- Prefer modifying UI in `src/components` and `src/app/...` and keep server-side API behavior consistent with existing API shape (returns JSON with `error` on failure and `message` on success).
- When adding code that touches sessions, check `src/lib/auth.ts` to ensure JWT/session callbacks are compatible.

# Where to ask follow-ups

- If uncertain about environment values or migration strategy, ask the maintainer which deployment flow they use (Docker or direct `next start`) and whether `prisma migrate deploy` is expected at startup.

