/* eslint-disable @typescript-eslint/no-require-imports */
/* global beforeEach */
require("@testing-library/jest-dom");

// In-memory caches live on globalThis: reset them so tests never see another test's data
beforeEach(() => {
  delete globalThis.__snowshareSettingsCache;
  globalThis.__snowshareRateLimit?.clear();
});
