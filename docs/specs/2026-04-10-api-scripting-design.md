# API/Scripting Capability — Design Spec

**Issue**: #215 — Ability to upload via API/scripting
**Date**: 2026-04-10
**Approach**: API Layer separee (routes `/api/v1/*`) avec refactoring des modules partages

---

## 1. Data Model — API Keys

New Prisma model:

```prisma
model ApiKey {
  id          String    @id @default(cuid())
  name        String                         // User-chosen label, e.g. "My backup script"
  keyHash     String    @unique              // SHA-256 of the raw token
  keyPrefix   String                         // First ~8 chars for UI identification
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())

  @@index([userId])
}
```

- Raw token format: `sk_<32 random hex chars>` — shown once at creation, never stored
- Only the SHA-256 hash is persisted
- `keyPrefix` (e.g. `sk_abc12345`) lets users identify keys in the UI
- Keys inherit all permissions from the owning User (no scopes)
- `expiresAt` is optional for temporary keys
- Add `apiKeys ApiKey[]` relation on the `User` model

---

## 2. Refactoring server.js

Extract duplicated business logic from `server.js` into shared TS modules:

| Duplicated logic in server.js         | Target module         | Function                               |
| ------------------------------------- | --------------------- | -------------------------------------- |
| Slug validation (`SLUG_REGEX.test()`) | `src/lib/security.ts` | `isValidSlug()` — already exists       |
| Password hashing (bcrypt cost 12)     | `src/lib/security.ts` | `hashPassword()` — already exists      |
| Anonymous expiry resolution           | `src/lib/security.ts` | `resolveAnonExpiry()` — already exists |
| IP quota calculation                  | `src/lib/quota.ts`    | New exported `calculateIpUsage()`      |
| Random slug generation                | `src/lib/security.ts` | New `generateRandomSlug()`             |
| Safe filename generation              | `src/lib/files.ts`    | New `generateSafeFilename()`           |
| Share creation in DB (single + bulk)  | `src/lib/shares.ts`   | New `createFileShare()` service        |

**`server.js` after refactoring**: retains only tus wiring (`onUploadCreate`/`onUploadFinish` hooks) and delegates all business logic to shared modules. Drops from ~600 lines to ~150-200.

**New `src/lib/shares.ts`** — Central service factoring share creation for all types:

- `createFileShare(params)` — used by `server.js` (tus) AND the new multipart endpoint
- `createLinkShare()` and `createPasteShare()` migrated here from their current files
- All functions enforce Settings admin checks (see section 4)

---

## 3. API Authentication Middleware

New file: `src/lib/api-auth.ts`

Function `authenticateApiRequest(req: NextRequest)` returns `{ user, authMethod: 'apikey' | 'session' | null }`.

Resolution order:

1. `Authorization: Bearer sk_...` header → SHA-256 hash lookup in `ApiKey` table, check expiration, update `lastUsedAt`
2. Fallback to `getServerSession(authOptions)` (NextAuth cookie)
3. Otherwise → unauthenticated (anonymous, subject to anon quotas)

Used by all `/api/v1/*` routes.

**tus support**: `authenticateFromRequest()` in `server.js` gains an API key fallback (same SHA-256 lookup) so tus uploads are also scriptable via `Authorization: Bearer sk_...`.

---

## 4. API v1 Routes

New route group: `src/app/api/v1/`

| Method   | Route                  | Description                                | Auth                     |
| -------- | ---------------------- | ------------------------------------------ | ------------------------ |
| `POST`   | `/api/v1/shares`       | Create a share (link or paste) — JSON body | API key / session / anon |
| `POST`   | `/api/v1/upload`       | Upload file — `multipart/form-data`        | API key / session / anon |
| `GET`    | `/api/v1/shares/:slug` | Get share metadata                         | API key / session / anon |
| `DELETE` | `/api/v1/shares/:slug` | Delete a share (owner only)                | API key / session        |
| `GET`    | `/api/v1/shares`       | List own shares                            | API key / session        |

### POST /api/v1/shares

Same JSON body as current `POST /api/shares`:

```json
{
  "type": "URL" | "PASTE",
  "urlOriginal": "https://...",       // for URL type
  "paste": "content",                 // for PASTE type
  "pastelanguage": "PYTHON",          // for PASTE type
  "slug": "my-custom-slug",           // optional
  "password": "secret",               // optional
  "expiresAt": "2026-05-01T00:00:00Z", // optional
  "maxViews": 100                     // optional
}
```

### POST /api/v1/upload

Accepts `multipart/form-data`:

- `file` — the file (required)
- `slug` — custom slug (optional)
- `password` — password protection (optional)
- `expiresAt` — expiration date ISO string (optional)
- `maxViews` — max view count (optional)

Streams the file to `uploads/` directory (no full buffer in memory).

Response: `{ share: { slug, url, expiresAt } }`

### Settings enforcement

All routes respect admin Settings:

- `allowAnonFileShare` / `allowAnonLinkShare` / `allowAnonPasteShare` — reject if disabled and unauthenticated
- `anoMaxUpload` / `authMaxUpload` — file size limits
- `anoIpQuota` / `authIpQuota` — IP quotas
- CAPTCHA — disabled for API key requests (key auth acts as gate)

This logic lives in the shared service `src/lib/shares.ts`, applied uniformly across frontend, tus, and API v1.

---

## 5. Scalar Documentation

### OpenAPI Spec

- `src/lib/openapi.ts` — exports OpenAPI 3.1 spec as JSON object, generated programmatically (stays in sync with code)
- `GET /api/v1/openapi.json` — serves the spec

### Scalar Page

- `src/app/api-docs/page.tsx` — client component with `@scalar/api-reference-react`
- Points to `/api/v1/openapi.json`
- Respects app theme (colors from Settings)
- Integrated `curl` examples for every endpoint (with `sk_YOUR_API_KEY` placeholder)
- Accessible from navbar/footer

### Documented content

- Authentication (API key via `Authorization: Bearer sk_...`)
- All v1 endpoints with request/response schemas
- Multipart upload (form-data fields)
- Tus upload (how to use with `tusc` or raw `curl`)
- Error codes and their meaning
- Quotas and limits

---

## 6. API Key Management UI

Integrated in the profile page (`src/app/profile/`).

### Component: `ApiKeysSection`

- List of keys: `keyPrefix`, `name`, `lastUsedAt`, `expiresAt`, delete button
- Creation form: name + optional expiration
- On creation: display raw token `sk_...` once in a copyable modal with warning "this key will not be shown again"

### Internal routes (not v1, used by frontend only)

- `POST /api/keys` — create a key (session cookie required)
- `GET /api/keys` — list own keys
- `DELETE /api/keys/[id]` — revoke a key

No admin management of other users' keys (can be added later).

---

## 7. Dependencies

New packages:

- `@scalar/api-reference-react` — Scalar UI component for API docs page

No other new dependencies needed — bcryptjs, crypto, Next.js built-ins cover everything else.

---

## 8. Files Changed / Created

### New files

- `prisma/migrations/<timestamp>_add_api_keys/` — migration
- `src/lib/api-auth.ts` — API authentication middleware
- `src/lib/shares.ts` — shared share creation service
- `src/lib/files.ts` — file utility functions
- `src/lib/openapi.ts` — OpenAPI spec
- `src/app/api/v1/shares/route.ts` — list + create shares
- `src/app/api/v1/shares/[slug]/route.ts` — get + delete share
- `src/app/api/v1/upload/route.ts` — multipart file upload
- `src/app/api/v1/openapi.json/route.ts` — serve OpenAPI spec
- `src/app/api/keys/route.ts` — create + list API keys
- `src/app/api/keys/[id]/route.ts` — delete API key
- `src/app/api-docs/page.tsx` — Scalar docs page
- `src/components/ApiKeysSection.tsx` — API key management UI

### Modified files

- `prisma/schema.prisma` — add `ApiKey` model + `User.apiKeys` relation
- `server.js` — replace inline logic with imports from shared modules
- `src/app/api/shares/route.ts` — delegate to shared service
- `src/app/api/shares/(linkShare)/linkshare.ts` — migrate to `src/lib/shares.ts`
- `src/app/api/shares/(pasteShare)/pasteshareshare.ts` — migrate to `src/lib/shares.ts`
- `src/lib/quota.ts` — export `calculateIpUsage()`
- `src/lib/security.ts` — add `generateRandomSlug()`
- `src/app/profile/page.tsx` — add `ApiKeysSection`
- i18n locale files (6) — add API key management translations
