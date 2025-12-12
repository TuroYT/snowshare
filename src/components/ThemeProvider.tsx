"use client"

import { useEffect, useState } from "react"

interface ThemeSettings {
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

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings | null>(null)

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const response = await fetch("/api/settings")
        if (!response.ok) return
        
        const data = await response.json()
        const settings = data.settings

        setTheme({
          primaryColor: settings.primaryColor || "#3B82F6",
          primaryHover: settings.primaryHover || "#2563EB",
          primaryDark: settings.primaryDark || "#1E40AF",
          secondaryColor: settings.secondaryColor || "#8B5CF6",
          secondaryHover: settings.secondaryHover || "#7C3AED",
          secondaryDark: settings.secondaryDark || "#6D28D9",
          backgroundColor: settings.backgroundColor || "#111827",
          surfaceColor: settings.surfaceColor || "#1F2937",
          textColor: settings.textColor || "#F9FAFB",
          textMuted: settings.textMuted || "#D1D5DB",
          borderColor: settings.borderColor || "#374151",
        })
      } catch (error) {
        console.error("Failed to fetch theme:", error)
      }
    }

    fetchTheme()
  }, [])

  useEffect(() => {
    if (!theme) return

    // Inject CSS variables into :root
    const root = document.documentElement
    root.style.setProperty("--primary", theme.primaryColor)
    root.style.setProperty("--primary-hover", theme.primaryHover)
    root.style.setProperty("--primary-dark", theme.primaryDark)
    root.style.setProperty("--secondary", theme.secondaryColor)
    root.style.setProperty("--secondary-hover", theme.secondaryHover)
    root.style.setProperty("--secondary-dark", theme.secondaryDark)
    root.style.setProperty("--background", theme.backgroundColor)
    root.style.setProperty("--surface", `${hexToRgba(theme.surfaceColor, 0.5)}`)
    root.style.setProperty("--surface-hover", `${hexToRgba(theme.surfaceColor, 0.7)}`)
    root.style.setProperty("--foreground", theme.textColor)
    root.style.setProperty("--foreground-muted", theme.textMuted)
    root.style.setProperty("--border", `${hexToRgba(theme.borderColor, 0.5)}`)
    root.style.setProperty("--border-hover", `${hexToRgba(theme.borderColor, 0.7)}`)
    root.style.setProperty("--input", theme.surfaceColor)
    root.style.setProperty("--input-focus", theme.backgroundColor)

    // Update dynamic gradients
    root.style.setProperty(
      "--gradient-primary",
      `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`
    )
    root.style.setProperty(
      "--gradient-secondary",
      `linear-gradient(135deg, ${theme.primaryDark} 0%, ${theme.secondaryDark} 100%)`
    )
  }, [theme])

  return <>{children}</>
}

/**
 * Convert hexadecimal color to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  hex = hex.replace("#", "")

  // Support short (#FFF) and long (#FFFFFF) formats
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
