# Security & Architecture Review — SnowShare

> Last review: 2026-09-25 (supersedes the 2026-03-18 review)

## Summary

The 2026-03 review items are resolved (paste XSS, inline SVG/HTML, missing security headers,
bcrypt cost, database indexes, Docker non-root user, duplicated MIME/quota code) except where
listed under **Open items**. The 2026-09 audit found and fixed the issues below.

## Fixed in the 2026-09 audit

### Critical / High

| Issue                                                                                                                                                                                | Fix                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API keys hashed with bcrypt (random salt): every key lookup failed, and each `Bearer sk_` request ran a blocking bcrypt                                                              | HMAC-SHA256 lookup hash keyed with `NEXTAUTH_SECRET` (`src/lib/security.ts`)                                                                                             |
| `maxViews` bypass: direct `GET /f/<slug>/download` never counted views; bulk ZIP and individual bulk files ignored the limit; `maxViews=1` files could not be downloaded from the UI | Atomic `consumeView()`; IP-bound signed download tokens replace `?password=` in URLs; every tokenless request (Range included) counts a view (`src/lib/share-access.ts`) |
| OAuth account-link token not bound to the browser that requested it (account takeover with providers that do not verify e-mails)                                                     | Token must match the httpOnly link cookie; link + token deletion in one transaction; accounts matched by `providerAccountId`                                             |
| Profile e-mail change without re-authentication, format check or re-verification                                                                                                     | Current password required, format/uniqueness checked, `emailVerified` reset and verification e-mail sent                                                                 |
| Client IP taken from the first (client-controlled) `X-Forwarded-For` entry                                                                                                           | Last entry by default, `TRUSTED_PROXY_COUNT` for proxy chains, `0` for direct exposure; server.js passes the socket-resolved IP to Next.js                               |
| Share passwords, logins, registrations, share e-mails and API keys not rate limited                                                                                                  | In-memory limiter (`src/lib/rate-limit.ts`), 429 + `Retry-After`                                                                                                         |
| Password hashes, uploader IPs and storage keys returned by share APIs                                                                                                                | `toPublicShare()` / `toUserShare()`                                                                                                                                      |
| Bulk and v1 uploads buffered whole files in memory; downloads ignored backpressure                                                                                                   | Streaming multipart receiver (`src/lib/multipart-upload.ts`), pull-based stream conversion                                                                               |
| tus uploads with `Upload-Defer-Length` skipped size and quota checks; quota check failed open                                                                                        | Per-user `maxSize` enforced while writing; quota errors refuse the upload                                                                                                |

### Medium / Low

- Deleting a share (profile, admin, v1 API) left bulk files (and, for v1, all files) in storage.
- Anonymous uploads ignored the "allow anonymous file sharing" setting on `/api/upload*`.
- Bulk uploads ignored S3; single S3 uploads were limited to 5 GB (now multipart).
- Editing a protected link stored the new URL in plaintext / broke decryption.
- The share edit form re-hashed the stored bcrypt hash as a new password.
- Race condition letting two concurrent first registrations become admin.
- Custom footer links accepted `javascript:` URLs; admin markdown preview rendered raw HTML.
- The S3 connectivity test could send the stored secret to an arbitrary endpoint.
- `next.config.ts` allowed the image optimizer to proxy any HTTPS host.
- Open image optimizer, loopback HTTP request and several settings queries on every page view (performance).

## Open items (not addressed, need larger changes)

1. **CSP allows `'unsafe-inline'` and `'unsafe-eval'`** in `script-src` (`src/proxy.ts`). Removing them requires nonces across the rendering pipeline.
2. **Paste content is stored in plaintext** even for password-protected pastes (links are encrypted). Encrypting pastes changes the storage format.
3. **No explicit CSRF tokens** on custom state-changing endpoints; protection relies on `SameSite=Lax` session cookies and JSON bodies.
4. **Rate limits and upload metadata are per process** (in memory). Running several instances needs a shared store (e.g. Redis).
5. **Account-link cookie is `SameSite=Lax`**: OAuth providers that call back with a cross-site POST (`response_mode=form_post`) cannot complete an explicit account link.
6. **Paste encryption, audit of third-party OAuth issuers and `pg_trgm` for admin search** remain out of scope.

## Security positives

- bcrypt (cost 12) for passwords; HMAC-SHA256 (server secret) for random API keys
- Strict slug validation, sanitized storage keys and `Content-Disposition` filenames
- SVG/HTML never served inline; `X-Content-Type-Options: nosniff` everywhere
- AES-256-CBC + PBKDF2 (100k) for protected link URLs
- Secrets (SMTP, S3, captcha, OAuth client secret) masked in admin APIs and never sent publicly
- Admin endpoints re-check `isAdmin` from the database; ownership checks on user resources
- Prisma ORM (no raw SQL built from user input)
