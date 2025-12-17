"use client"

import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import en from "./locales/en.json"
import fr from "./locales/fr.json"
import es from "./locales/es.json"
import de from "./locales/de.json"
import pl from "./locales/pl.json"
import nl from "./locales/nl.json"

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      de: { translation: de },
      pl: { translation: pl },
      nl: { translation: nl}
    },
    fallbackLng: "fr",
    supportedLngs: ["fr", "en", "es", "de", "pl", "nl"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["querystring", "localStorage", "cookie", "navigator"],
      caches: ["localStorage", "cookie"],
    },
  })

export default i18n
