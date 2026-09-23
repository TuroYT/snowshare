import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import NextAuthProvider from "@/components/NextAuthProvider";
import { ThemeInitializer } from "@/components/ThemeInitializer";
import { Toaster } from "@/components/ui/Toast";
import PlausibleProvider from "next-plausible";
import LoadingScreen from "@/components/LoadingScreen";
import { Suspense } from "react";
import "@/i18n/client";
import { getPublicSettings } from "@/lib/settings";
import { resolveDefaultLocale } from "@/i18n/locale-utils";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export const revalidate = 0; // Disable caching for metadata

const SUPPORTED_LOCALES = ["en", "fr", "es", "de", "pl", "nl"];

const geistSans = GeistSans;
const geistMono = GeistMono;

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPublicSettings();
  const settings = data?.settings;

  return {
    title: settings?.appName || "SnowShare",
    description: settings?.appDescription || "Share your files, pastes, and URLs securely",
    icons: settings?.faviconUrl
      ? {
          icon: [{ url: settings.faviconUrl }],
          shortcut: [{ url: settings.faviconUrl }],
          apple: [{ url: settings.faviconUrl }],
        }
      : undefined,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const telemetryEnabled = process.env.TELEMETRY !== "false" && process.env.TELEMETRY !== "False";
  const plausibleDomain = process.env.PLAUSIBLE_DOMAIN || "snowshare.app";
  const plausibleHost = process.env.PLAUSIBLE_HOST || "https://stats.sheephost.fr";

  return (
    <html lang={resolveDefaultLocale(SUPPORTED_LOCALES)} suppressHydrationWarning>
      <head>
        {/* Privacy-friendly analytics by Plausible - no cookies, GDPR compliant */}
        {/* Disable with TELEMETRY=false in .env */}

        <PlausibleProvider
          domain={plausibleDomain}
          customDomain={plausibleHost}
          selfHosted={true}
          trackLocalhost={true}
          enabled={telemetryEnabled}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem>
          <NextAuthProvider>
            <Suspense fallback={<LoadingScreen />}>
              <ThemeInitializer>{children}</ThemeInitializer>
            </Suspense>
            <Toaster />
          </NextAuthProvider>
        </NextThemesProvider>
      </body>
    </html>
  );
}
