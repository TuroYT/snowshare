"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

export interface ThemeColors {
  primaryColor: string
  primaryHover: string
  primaryDark: string
  secondaryColor: string
  secondaryHover: string
  secondaryDark: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  textMuted: string
  borderColor: string
}

export interface BrandingSettings {
  appName: string
  appDescription: string
  logoUrl: string | null
  faviconUrl: string | null
}

export interface ThemeContextType {
  colors: ThemeColors
  branding: BrandingSettings
  isLoading: boolean
  updateTheme: (colors: Partial<ThemeColors>) => void
  refreshSettings: () => Promise<void>
}

const defaultColors: ThemeColors = {
  primaryColor: "#3B82F6",
  primaryHover: "#2563EB",
  primaryDark: "#1E40AF",
  secondaryColor: "#8B5CF6",
  secondaryHover: "#7C3AED",
  secondaryDark: "#6D28D9",
  backgroundColor: "#111827",
  surfaceColor: "#1F2937",
  textColor: "#F9FAFB",
  textMuted: "#D1D5DB",
  borderColor: "#374151",
}

const defaultBranding: BrandingSettings = {
  appName: "SnowShare",
  appDescription: "Partagez vos fichiers, pastes et URLs en toute sécurité",
  logoUrl: null,
  faviconUrl: null,
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<ThemeColors>(defaultColors)
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      if (!response.ok) {
        setIsLoading(false)
        return
      }

      const data = await response.json()
      const settings = data.settings

      const newColors: ThemeColors = {
        primaryColor: settings.primaryColor || defaultColors.primaryColor,
        primaryHover: settings.primaryHover || defaultColors.primaryHover,
        primaryDark: settings.primaryDark || defaultColors.primaryDark,
        secondaryColor: settings.secondaryColor || defaultColors.secondaryColor,
        secondaryHover: settings.secondaryHover || defaultColors.secondaryHover,
        secondaryDark: settings.secondaryDark || defaultColors.secondaryDark,
        backgroundColor: settings.backgroundColor || defaultColors.backgroundColor,
        surfaceColor: settings.surfaceColor || defaultColors.surfaceColor,
        textColor: settings.textColor || defaultColors.textColor,
        textMuted: settings.textMuted || defaultColors.textMuted,
        borderColor: settings.borderColor || defaultColors.borderColor,
      }

      const newBranding: BrandingSettings = {
        appName: settings.appName || defaultBranding.appName,
        appDescription: settings.appDescription || defaultBranding.appDescription,
        logoUrl: settings.logoUrl || null,
        faviconUrl: settings.faviconUrl || null,
      }

      setColors(newColors)
      setBranding(newBranding)
      applyThemeToDOM(newColors)
    } catch (error) {
      console.error("Failed to fetch theme:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshSettings()
  }, [])

  const updateTheme = (newColors: Partial<ThemeColors>) => {
    const updatedColors = { ...colors, ...newColors }
    setColors(updatedColors)
    applyThemeToDOM(updatedColors)
  }

  // Apply branding metadata (title, favicon) when ready
  useEffect(() => {
    if (!isLoading) {
      applyBrandingMeta(branding)
    }
  }, [branding, isLoading])

  return (
    <ThemeContext.Provider value={{ colors, branding, isLoading, updateTheme, refreshSettings }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

/**
 * Apply theme colors to CSS custom properties
 */
function applyThemeToDOM(colors: ThemeColors) {
  const root = document.documentElement

  // Primary colors
  root.style.setProperty("--primary", colors.primaryColor)
  root.style.setProperty("--primary-hover", colors.primaryHover)
  root.style.setProperty("--primary-dark", colors.primaryDark)

  // Secondary colors
  root.style.setProperty("--secondary", colors.secondaryColor)
  root.style.setProperty("--secondary-hover", colors.secondaryHover)
  root.style.setProperty("--secondary-dark", colors.secondaryDark)

  // Background colors
  root.style.setProperty("--background", colors.backgroundColor)
  root.style.setProperty("--surface", hexToRgba(colors.surfaceColor, 0.5))
  root.style.setProperty("--surface-hover", hexToRgba(colors.surfaceColor, 0.7))
  root.style.setProperty("--input", colors.surfaceColor)
  root.style.setProperty("--input-focus", colors.backgroundColor)

  // Text colors
  root.style.setProperty("--foreground", colors.textColor)
  root.style.setProperty("--foreground-muted", colors.textMuted)

  // Border colors
  root.style.setProperty("--border", hexToRgba(colors.borderColor, 0.5))
  root.style.setProperty("--border-hover", hexToRgba(colors.borderColor, 0.7))

  // Gradients
  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, ${colors.primaryColor} 0%, ${colors.secondaryColor} 100%)`
  )
  root.style.setProperty(
    "--gradient-secondary",
    `linear-gradient(135deg, ${colors.primaryDark} 0%, ${colors.secondaryDark} 100%)`
  )
}

// Update document metadata (favicon, title) when branding changes
function applyBrandingMeta(branding: BrandingSettings) {
  if (branding.appName) {
    document.title = branding.appName
  }

  if (branding.faviconUrl) {
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
}

// (no-op outside React components)

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  hex = hex.replace("#", "")

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("")
  }

  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
