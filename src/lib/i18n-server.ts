/**
 * Server-side i18n for API routes
 * Simple synchronous translation lookup — no async, no i18next dependency
 */

import { NextRequest } from "next/server";
import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";
import es from "@/i18n/locales/es.json";
import de from "@/i18n/locales/de.json";
import pl from "@/i18n/locales/pl.json";
import nl from "@/i18n/locales/nl.json";

export const SUPPORTED_LOCALES = ["fr", "en", "es", "de", "pl", "nl"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: SupportedLocale = "en";

const translations: Record<string, Record<string, unknown>> = {
  en,
  fr,
  es,
  de,
  pl,
  nl,
};

/**
 * Resolve a dot-separated key in a nested object
 * e.g. "api.errors.signup_disabled" → obj.api.errors.signup_disabled
 */
function resolveKey(obj: Record<string, unknown>, key: string): string | undefined {
  let current: unknown = obj;
  for (const part of key.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Translate a key for a given locale, with optional interpolation.
 * Falls back to DEFAULT_LOCALE, then to the raw key.
 */
export function translate(
  locale: SupportedLocale,
  key: string,
  params?: Record<string, string | number | undefined>
): string {
  let value =
    resolveKey(translations[locale], key) ??
    resolveKey(translations[DEFAULT_LOCALE], key) ??
    key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        value = value.replaceAll(`{{${k}}}`, String(v));
      }
    }
  }

  return value;
}

/**
 * Detects the locale from various sources in order of priority:
 * 1. Query parameter (?lang=en)
 * 2. Cookie (i18nextLng or NEXT_LOCALE)
 * 3. Accept-Language header
 * 4. Default locale
 */
export function detectLocale(request: NextRequest): SupportedLocale {
  // 1. Query parameter
  const queryLocale = request.nextUrl.searchParams.get("lang");
  if (queryLocale && SUPPORTED_LOCALES.includes(queryLocale as SupportedLocale)) {
    return queryLocale as SupportedLocale;
  }

  // 2. Cookies
  const cookieLocale =
    request.cookies.get("i18next")?.value ||
    request.cookies.get("i18nextLng")?.value ||
    request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as SupportedLocale)) {
    return cookieLocale as SupportedLocale;
  }

  // 3. Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const [code, qValue] = lang.trim().split(";");
        const q = qValue ? parseFloat(qValue.split("=")[1]) : 1.0;
        const baseCode = code.split("-")[0].toLowerCase();
        return { code: baseCode, q };
      })
      .sort((a, b) => b.q - a.q);

    for (const { code } of languages) {
      if (SUPPORTED_LOCALES.includes(code as SupportedLocale)) {
        return code as SupportedLocale;
      }
    }
  }

  // 4. Default
  return DEFAULT_LOCALE;
}
