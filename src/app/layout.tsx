import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NextAuthProvider from "@/components/NextAuthProvider";
import { ThemeInitializer } from "@/components/ThemeInitializer";
import PlausibleProvider from "next-plausible";
import LoadingScreen from "@/components/LoadingScreen";
import { Suspense } from "react";
import "@/i18n/client";
import { getPublicSettings } from "@/lib/settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPublicSettings();
  const settings = data?.settings;

  return {
    title: settings?.appName || "SnowShare",
    description: settings?.appDescription || "Partagez vos fichiers, pastes et URLs en toute sécurité",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const telemetryEnabled = process.env.TELEMETRY !== 'false' && process.env.TELEMETRY !== 'False';
  const plausibleDomain = process.env.PLAUSIBLE_DOMAIN || 'snowshare.app';
  const plausibleHost = process.env.PLAUSIBLE_HOST || 'https://stats.sheephost.fr';
  
  return (
    <html lang="fr" className="dark">
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          backgroundColor: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        <NextAuthProvider>
          <Suspense fallback={<LoadingScreen />}>
            <ThemeInitializer>
              {children}
            </ThemeInitializer>
          </Suspense>
        </NextAuthProvider>
      </body>
    </html>
  );
}
