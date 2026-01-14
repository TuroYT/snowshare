import type { Metadata } from "next"
import { getPublicSettings } from "@/lib/settings"

export const revalidate = 0; // Disable caching for metadata

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPublicSettings()
  const settings = data?.settings

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
  }
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
