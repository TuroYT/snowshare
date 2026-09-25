/* eslint-disable @typescript-eslint/no-require-imports */
/* global beforeEach */
require("@testing-library/jest-dom");

// Server helpers (API key hashing, download tokens) require a secret
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-nextauth-secret";

// In-memory caches live on globalThis: reset them so tests never see another test's data
beforeEach(() => {
  delete globalThis.__snowshareSettingsCache;
  globalThis.__snowshareRateLimit?.clear();
});
