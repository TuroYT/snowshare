/**
 * Tests that all locale files under src/i18n/locales expose the exact same set of
 * translation keys, and that any {{placeholder}} used in a translated string also
 * exists in the corresponding English (reference) string for the same key.
 */

import fs from "fs";
import path from "path";

const LOCALES_DIR = path.join(__dirname, "..", "..", "i18n", "locales");
const REFERENCE_LOCALE = "en";
const LOCALES = ["en", "fr", "es", "de", "nl", "pl"];

type LocaleTree = { [key: string]: string | LocaleTree };

function flatten(obj: LocaleTree, prefix = ""): Record<string, string> {
  let out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out = { ...out, ...flatten(value, fullKey) };
    } else {
      out[fullKey] = value as string;
    }
  }
  return out;
}

function loadFlatLocale(locale: string): Record<string, string> {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), "utf8");
  const parsed = JSON.parse(raw) as LocaleTree;
  return flatten(parsed);
}

function extractPlaceholders(value: string): string[] {
  if (typeof value !== "string") return [];
  const matches = value.match(/\{\{[^}]+\}\}/g);
  return matches ? [...matches].sort() : [];
}

describe("locale key parity", () => {
  const flatLocales: Record<string, Record<string, string>> = {};

  beforeAll(() => {
    for (const locale of LOCALES) {
      flatLocales[locale] = loadFlatLocale(locale);
    }
  });

  it("has valid JSON for every locale file", () => {
    for (const locale of LOCALES) {
      expect(() => loadFlatLocale(locale)).not.toThrow();
    }
  });

  it.each(LOCALES.filter((locale) => locale !== REFERENCE_LOCALE))(
    "%s has no missing keys compared to the reference locale (en)",
    (locale) => {
      const referenceKeys = new Set(Object.keys(flatLocales[REFERENCE_LOCALE]));
      const localeKeys = new Set(Object.keys(flatLocales[locale]));
      const missing = [...referenceKeys].filter((key) => !localeKeys.has(key));

      expect(missing).toEqual([]);
    }
  );

  it.each(LOCALES.filter((locale) => locale !== REFERENCE_LOCALE))(
    "%s has no extra keys compared to the reference locale (en)",
    (locale) => {
      const referenceKeys = new Set(Object.keys(flatLocales[REFERENCE_LOCALE]));
      const localeKeys = new Set(Object.keys(flatLocales[locale]));
      const extra = [...localeKeys].filter((key) => !referenceKeys.has(key));

      expect(extra).toEqual([]);
    }
  );

  it.each(LOCALES.filter((locale) => locale !== REFERENCE_LOCALE))(
    "%s translations use the same {{placeholders}} as the reference locale (en) for shared keys",
    (locale) => {
      const referenceFlat = flatLocales[REFERENCE_LOCALE];
      const localeFlat = flatLocales[locale];
      const mismatches: string[] = [];

      for (const key of Object.keys(referenceFlat)) {
        if (!(key in localeFlat)) continue;

        const referencePlaceholders = extractPlaceholders(referenceFlat[key]).join(",");
        const localePlaceholders = extractPlaceholders(localeFlat[key]).join(",");

        if (referencePlaceholders !== localePlaceholders) {
          mismatches.push(
            `${key}: en=[${referencePlaceholders}] ${locale}=[${localePlaceholders}]`
          );
        }
      }

      expect(mismatches).toEqual([]);
    }
  );
});
