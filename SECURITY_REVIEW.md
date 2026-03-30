# Security & Architecture Review — SnowShare

> Review date: 2026-03-18

## Summary

| Severity     | Count |
| ------------ | ----- |
| Critical     | 1     |
| High         | 3     |
| Medium       | 8     |
| Architecture | 7     |

---

## Security Issues

### CRITICAL

#### 1. XSS via `dangerouslySetInnerHTML` on paste display

**File:** `src/app/(shares)/p/[slug]/page.tsx:178`

```tsx
dangerouslySetInnerHTML={{ __html: highlighted || pasteData.paste }}
```

If `highlighted` is empty (e.g. unsupported language, `PLAINTEXT` fallback), the raw user-supplied paste content is injected directly into the DOM without escaping. An attacker can create a paste containing `<script>alert(document.cookie)</script>` which will execute in every visitor's browser.

**Recommendation:** Always sanitize the fallback with DOMPurify, or use `textContent` / a `<code>` element when there is no Prism.js output.

---

### HIGH

#### 2. SVG/HTML files served inline — Stored XSS

**File:** `src/app/api/download/[slug]/route.ts:128-131`

```ts
if (
  contentType.startsWith("image/") ||
  contentType === "application/pdf" ||
  contentType.startsWith("text/")
) {
  headers.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`);
}
```

SVG files (`image/svg+xml`) and HTML files (`text/html`) are served with `Content-Disposition: inline`. A malicious SVG can contain embedded JavaScript that executes in the context of the application's domain, giving access to cookies and session tokens.

**Recommendation:** Never serve SVG/HTML inline. Either force `attachment` for these types, or serve user-uploaded content from a separate sandbox domain.

#### 3. IP spoofing via X-Forwarded-For

**Files:** `src/lib/getClientIp.ts`, `server.js:41-76`

Both IP resolution functions blindly trust the `X-Forwarded-For` header without verifying it comes from a trusted proxy. An attacker can forge this header to:

- Bypass IP-based upload quotas entirely
- Impersonate another user's IP address

**Recommendation:** Only read `X-Forwarded-For` when the request originates from a known/trusted proxy IP. Alternatively, read the _last_ IP appended by the trusted proxy rather than the first (client-controlled) value.

#### 4. No rate limiting on password attempts

**Files:** `src/app/(shares)/p/[slug]/api/route.ts`, `src/app/(shares)/f/[slug]/api/route.ts`, `src/app/(shares)/l/[slug]/private/page.tsx`

Password-protected shares have no limit on verification attempts. An attacker can brute-force passwords on any protected share without throttling.

**Recommendation:** Implement per-IP rate limiting after N failed attempts (e.g. 5 attempts per minute per share).

---

### MEDIUM

#### 5. Missing Next.js middleware (no security headers)

**File:** `src/middleware.ts` — **does not exist**

The project has no Next.js middleware, which means:

- No `Content-Security-Policy` header
- No `Strict-Transport-Security` (HSTS)
- No `X-Frame-Options` / `X-Content-Type-Options`
- No centralized route protection for `/admin/*` and `/profile/*`
- No setup redirect when no users exist

Each API route handles its own auth checks, which is fragile and error-prone.

**Recommendation:** Create `src/middleware.ts` with security headers and centralized auth checks for protected routes.

#### 6. Password transmitted in query string

**File:** `src/app/api/download/[slug]/route.ts:31`

```ts
const password = url.searchParams.get("password") || undefined;
```

Passwords in URLs are logged in server access logs, browser history, proxy logs, and referrer headers.

**Recommendation:** Use a POST request or an `Authorization` header to transmit the password.

#### 7. Paste content stored unencrypted in database

**File:** `prisma/schema.prisma:73`

Password-protected links encrypt the URL with AES-256-CBC before storage, but password-protected pastes store content in plaintext. If the database is compromised, all paste content is exposed regardless of password protection.

**Recommendation:** Encrypt paste content at rest when password-protected, similar to the link encryption in `src/lib/crypto-link.ts`.

#### 8. Inconsistent bcrypt cost factor

**Files:** `src/app/api/user/profile/route.ts` (cost 10), all other files (cost 12)

Passwords changed via the profile endpoint use bcrypt cost 10 while the rest of the codebase uses cost 12. This makes profile-changed passwords weaker.

**Recommendation:** Standardize on cost 12 everywhere. Extract to a constant.

#### 9. Memory leak in `uploadMetadata` Map

**File:** `server.js:173`

```js
const uploadMetadata = new Map();
```

Entries are added in `onUploadCreate` but only deleted in `onUploadFinish`. If an upload is started but never completed (client disconnect, error, timeout), the entry remains in memory forever.

**Recommendation:** Add a TTL-based cleanup (e.g. `setInterval` that purges entries older than 1 hour).

#### 10. Race condition on slug creation

**Files:** `server.js:276`, `src/app/api/shares/(linkShare)/linkshare.ts:24`, `src/app/api/upload/route.ts:395`

The `findUnique` → `create` pattern is not atomic. Two simultaneous requests with the same slug can both pass the uniqueness check. The `@unique` DB constraint prevents data corruption, but the resulting Prisma P2002 error is not caught.

**Recommendation:** Wrap `create` in a try/catch and handle P2002 with a user-friendly "slug already taken" error.

#### 11. No Prisma transactions on critical paths

**Files:** `server.js:438-501` (share create + filePath update), `src/lib/auth.ts:165-190` (account link + token delete)

Multi-step database operations are not wrapped in `prisma.$transaction()`. If the second operation fails, data is left in an inconsistent state (e.g. share created with empty filePath, account linked but token not deleted).

**Recommendation:** Use `prisma.$transaction()` for all multi-step DB operations.

#### 12. No CSRF protection on custom API endpoints

**Files:** All POST/PATCH/DELETE API routes

NextAuth handles CSRF for its own routes, but custom endpoints like `POST /api/shares` rely only on SameSite cookie behavior. This may not be sufficient in all browsers/configurations.

**Recommendation:** Add explicit CSRF token validation for state-changing operations.

---

## Architecture Issues

### 13. Triple duplication of quota calculation + incorrect path

**Files:**

- `server.js:130` — `calculateIpUsage()`
- `src/lib/quota.ts:25` — `calculateIpUploadSize()`
- `src/app/api/upload/route.ts:44` — `calculateIpUploadSizeBytes()`

Three implementations of the same logic with subtle differences. Additionally, `quota.ts:40` uses `path.join(process.cwd(), share.filePath)` instead of `getUploadDir()`, so it looks for files in the wrong directory when `UPLOAD_DIR` is configured.

**Recommendation:** Consolidate into a single function in `src/lib/quota.ts` and use it everywhere (including server.js via dynamic import).

### 14. MIME type map duplicated in 4 files

**Files:**

- `src/app/(shares)/f/[slug]/api/route.ts`
- `src/app/(shares)/f/[slug]/download/route.ts`
- `src/app/api/download/[slug]/route.ts`
- `src/lib/bulk-upload-utils.ts`

The same MIME type mapping is copy-pasted across 4 files.

**Recommendation:** Extract to `src/lib/mime-types.ts`.

### 15. Missing database indexes

**File:** `prisma/schema.prisma`

The `Share` model only has a unique index on `slug`. The following frequently-queried columns lack indexes:

- `ipSource` — used in every quota calculation
- `ownerId` — used to list a user's shares
- `expiresAt` — used for expired share cleanup
- `createdAt` — used for sorting

**Recommendation:**

```prisma
@@index([ipSource])
@@index([ownerId])
@@index([expiresAt])
@@index([createdAt])
```

### 16. No pagination on list endpoints

**Files:**

- `GET /api/admin/users` — returns all users
- `GET /api/user/shares` — returns all shares for a user
- `GET /api/admin/logs` — returns all logs

These endpoints will degrade as data grows.

**Recommendation:** Add `limit`/`offset` (or cursor-based) pagination.

### 17. Blocking `statSync` in download routes

**Files:** `src/app/(shares)/f/[slug]/api/route.ts`, `src/app/(shares)/f/[slug]/download/route.ts`

Synchronous `statSync()` calls block the Node.js event loop during file downloads.

**Recommendation:** Replace with async `stat()` from `fs/promises`.

### 18. Duplicated share creation logic in server.js

**File:** `server.js:330-450`

The `onUploadFinish` callback contains two near-identical code blocks for bulk (first file) and single uploads: slug validation, expiration parsing, anonymous 7-day cap, password hashing, and share creation.

**Recommendation:** Extract to a shared `createShareFromUploadMetadata()` function.

### 19. Docker and dependency issues

**File:** `Dockerfile`

- Container runs as **root** — should add a non-root `USER` directive
- No `HEALTHCHECK` instruction

**File:** `package.json`

- Both `@next-auth/prisma-adapter` (v1.0.7) and `@auth/prisma-adapter` (v2.10.0) are listed — only one should be used

---

## Security Positives

- Bcrypt used for all password hashing (minor cost inconsistency noted)
- Strict slug validation regex (`/^[a-zA-Z0-9_-]{3,30}$/`)
- Filename sanitization prevents path traversal in uploads
- AES-256-CBC encryption for password-protected link URLs with PBKDF2 (100k iterations)
- JWT session strategy properly configured
- File streaming prevents memory exhaustion on large uploads
- Authentication checks present on all admin endpoints
- Prisma ORM prevents SQL injection
