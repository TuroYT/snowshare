/**
 * Server-side i18n for API routes
 * Simple synchronous translation lookup — no async, no i18next dependency
 */

import { NextRequest } from "next/server";
import { resolveDefaultLocale } from "@/i18n/locale-utils";
import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";
import es from "@/i18n/locales/es.json";
import de from "@/i18n/locales/de.json";
import pl from "@/i18n/locales/pl.json";
import nl from "@/i18n/locales/nl.json";

export const SUPPORTED_LOCALES = ["fr", "en", "es", "de", "pl", "nl"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE = resolveDefaultLocale(SUPPORTED_LOCALES) as SupportedLocale;

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
    resolveKey(translations[locale], key) ?? resolveKey(translations[DEFAULT_LOCALE], key) ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        value = value.replaceAll(`{{${k}}}`, String(v));
      }
    }
  }

  return value;
}

function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return !!value && SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

/** Picks the best supported locale from an Accept-Language header. */
function localeFromAcceptLanguage(acceptLanguage: string | null): SupportedLocale | null {
  if (!acceptLanguage) return null;
  const languages = acceptLanguage
    .split(",")
    .map((lang) => {
      const [code, qValue] = lang.trim().split(";");
      const q = qValue ? Number.parseFloat(qValue.split("=")[1]) : 1;
      const baseCode = code.split("-")[0].toLowerCase();
      return { code: baseCode, q };
    })
    .sort((a, b) => b.q - a.q);

  return languages.map(({ code }) => code).find(isSupportedLocale) ?? null;
}

const LOCALE_COOKIES = ["i18next", "i18nextLng", "NEXT_LOCALE"];

/**
 * Detects the locale from various sources in order of priority:
 * 1. Query parameter (?lang=en)
 * 2. Cookie (i18nextLng or NEXT_LOCALE)
 * 3. Accept-Language header
 * 4. Default locale
 */
export function detectLocale(request: NextRequest): SupportedLocale {
  const queryLocale = request.nextUrl.searchParams.get("lang");
  if (isSupportedLocale(queryLocale)) return queryLocale;

  const cookieLocale = LOCALE_COOKIES.map((name) => request.cookies.get(name)?.value).find(Boolean);
  if (isSupportedLocale(cookieLocale)) return cookieLocale;

  return localeFromAcceptLanguage(request.headers.get("accept-language")) ?? DEFAULT_LOCALE;
}

/**
 * Detects the locale from request headers only (server components and generateMetadata,
 * which get headers() instead of a NextRequest): cookies, then Accept-Language.
 */
export function detectLocaleFromHeaders(headers: Headers): SupportedLocale {
  const cookies = new Map(
    (headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => name && value)
      .map(([name, value]) => [name, value] as const)
  );
  const cookieLocale = LOCALE_COOKIES.map((name) => cookies.get(name)).find(Boolean);
  if (isSupportedLocale(cookieLocale)) return cookieLocale;

  return localeFromAcceptLanguage(headers.get("accept-language")) ?? DEFAULT_LOCALE;
}
