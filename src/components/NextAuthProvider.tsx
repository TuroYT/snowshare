"use client";

import { SessionProvider } from "next-auth/react";
import { I18nextProvider } from "react-i18next";
import i18n, { supportedLngs } from "@/i18n/client";
import { BrandingProvider } from "@/components/BrandingProvider";
import { useEffect } from "react";

function I18nHydrationSync({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Detect stored language after hydration to avoid SSR/client mismatch.
    const stored =
      localStorage.getItem("i18nextLng") || localStorage.getItem("i18next") || navigator.language;
    const lang = (supportedLngs as readonly string[]).find((l) => stored?.startsWith(l));
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang);
    }
  }, []);

  return <>{children}</>;
}

export default function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BrandingProvider>
        <I18nextProvider i18n={i18n}>
          <I18nHydrationSync>{children}</I18nHydrationSync>
        </I18nextProvider>
      </BrandingProvider>
    </SessionProvider>
  );
}
