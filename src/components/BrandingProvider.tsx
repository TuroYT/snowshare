"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

export interface Branding {
  appName: string
  appDescription: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  accentColor: string
}

const defaultBranding: Branding = {
  appName: "SnowShare",
  appDescription: "Partagez vos fichiers, pastes et URLs en toute sécurité",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#3B82F6",
  accentColor: "#8B5CF6",
}

interface BrandingContextType {
  branding: Branding
  loading: boolean
  refreshBranding: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  loading: true,
  refreshBranding: async () => {},
})

export function useBranding() {
  return useContext(BrandingContext)
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(defaultBranding)
  const [loading, setLoading] = useState(true)

  const fetchBranding = async () => {
    try {
      const response = await fetch("/api/settings/branding")
      if (response.ok) {
        const data = await response.json()
        setBranding(data.branding)
      }
    } catch (error) {
      console.error("Failed to fetch branding:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBranding()
  }, [])

  // Apply CSS custom properties for colors
  useEffect(() => {
    if (!loading) {
      document.documentElement.style.setProperty("--color-primary", branding.primaryColor)
      document.documentElement.style.setProperty("--color-accent", branding.accentColor)
    }
  }, [branding, loading])

  // Update favicon dynamically
  useEffect(() => {
    if (!loading && branding.faviconUrl) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
      if (link) {
        link.href = branding.faviconUrl
      } else {
        const newLink = document.createElement("link")
        newLink.rel = "icon"
        newLink.href = branding.faviconUrl
        document.head.appendChild(newLink)
      }
    }
  }, [branding.faviconUrl, loading])

  // Update document title
  useEffect(() => {
    if (!loading) {
      document.title = branding.appName
    }
  }, [branding.appName, loading])

  return (
    <BrandingContext.Provider value={{ branding, loading, refreshBranding: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  )
}
