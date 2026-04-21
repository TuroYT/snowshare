# Copilot Code Review Instructions

## Tone & approach

- Be concise. Flag real issues, skip nitpicks.
- Do not request changes for style preferences that are already consistent with the rest of the codebase.
- Do not suggest adding comments, docstrings, or type annotations to unchanged code.
- Do not suggest refactoring code that is not part of the PR diff.
- If something looks intentional and works, don't flag it.

## What to flag

- Security issues: injection, XSS, credential leaks, missing auth checks
- Bugs: logic errors, off-by-one, race conditions, unhandled error paths
- Breaking changes: Prisma migrations that could lose data, API contract changes without backwards compat
- Missing i18n: new user-facing text not added to all 6 locale files (`en`, `fr`, `de`, `es`, `nl`, `pl`)
- Import violations: relative imports (`../`) instead of `@/` alias

## What NOT to flag

- Missing JSDoc or inline comments on clear code
- Suggesting `const` over `let` when `let` is valid
- Proposing abstractions for code used in only one place
- Renaming variables to longer names when the short name is clear in context
- Adding error handling for impossible states (e.g., validating internal function args)
- Cosmetic formatting differences already handled by Prettier/ESLint

## Project-specific rules

- **Passwords** must use bcryptjs with cost 12
- **Slugs** must match `/^[a-zA-Z0-9_-]{3,30}$/`
- **API responses**: success `{ data }` or `{ share }`, error `{ error: "message" }` with proper HTTP status
- **Prisma imports**: types from `@/generated/prisma`, client from `@/lib/prisma`
- **Client components**: must have `"use client"` directive
- **Translations**: use `t("section.key")` client-side, `getT(request)` server-side
- **API errors**: use `apiError(request, ErrorCode.XXX)` from `@/lib/api-errors`, not hardcoded responses
