import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NextAuthProvider from "@/components/NextAuthProvider";
import PlausibleProvider from "next-plausible";
import "@/i18n/client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SnowShare",
  description: "Partagez vos fichiers, pastes et URLs en toute sécurité",
};

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-900 text-gray-100 `}
      >
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}
