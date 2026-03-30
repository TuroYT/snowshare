"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
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

const supportedLngs = languages.map((lang) => lang.code);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    supportedLngs,
    interpolation: { escapeValue: false },
    detection: {
      order: ["querystring", "localStorage", "cookie", "navigator"],
      caches: ["localStorage", "cookie"],
    },
  });

export default i18n;
