"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import de from "./locales/de.json";
import pl from "./locales/pl.json";
import nl from "./locales/nl.json";

export const languages = [
  { code: "fr", label: "🇫🇷 FR" },
  { code: "en", label: "🇬🇧 EN" },
  { code: "es", label: "🇪🇸 ES" },
  { code: "de", label: "🇩🇪 DE" },
  { code: "pl", label: "🇵🇱 PL" },
  { code: "nl", label: "🇳🇱 NL" },
] as const;

const translationResources = {
  en,
  fr,
  es,
  de,
  pl,
  nl,
};

const resources = Object.fromEntries(
  languages.map((lang) => [
    lang.code,
    { translation: translationResources[lang.code as keyof typeof translationResources] },
  ])
);

export const supportedLngs = languages.map((lang) => lang.code);

// NEXT_PUBLIC_* vars are inlined at build time — changing this requires a rebuild.
const _envLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en";
const defaultLocale = supportedLngs.includes(_envLocale) ? _envLocale : "en";

// Initialize with a fixed language so SSR and the initial client render match.
// Language detection runs client-side after hydration (see NextAuthProvider).
i18n.use(initReactI18next).init({
  resources,
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  supportedLngs,
  interpolation: { escapeValue: false },
});

export default i18n;
