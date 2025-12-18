"use client"

import { useState, useEffect, useCallback } from "react"
import { Snackbar, Alert as MuiAlert } from "@mui/material"
import { useTranslation } from "react-i18next"
import { useTheme } from "@/hooks/useTheme"
import Image from "next/image"
import { ThemePresetSelector } from "./ThemePresetSelector"

interface BrandingSettings {
  appName: string
  appDescription: string
  logoUrl: string | null
  faviconUrl: string | null
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

export default function BrandingTab() {
  const { t } = useTranslation()
  const { updateTheme, refreshSettings } = useTheme()
  const [settings, setSettings] = useState<BrandingSettings>({
    appName: "SnowShare",
    appDescription: "Partagez vos fichiers, pastes et URLs en toute sécurité",
    logoUrl: null,
    faviconUrl: null,
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
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastErrorOpen, setToastErrorOpen] = useState(false)

  const isHexColor = (v: string) => /^#([0-9A-Fa-f]{6})$/.test(v?.trim?.() || "")
  const isValidUrl = (v: string) => {
    try {
      new URL(v)
      return true
    } catch {
      return false
    }
  }

  const validateSettingsBeforeSave = (): boolean => {
    // Required text fields
    if (!settings.appName?.trim() || !settings.appDescription?.trim()) {
      setError(t("admin.validation_required"))
      setToastErrorOpen(true)
      return false
    }

    // Validate colors
    const colorKeys: (keyof BrandingSettings)[] = [
      "primaryColor",
      "primaryHover",
      "primaryDark",
      "secondaryColor",
      "secondaryHover",
      "secondaryDark",
      "backgroundColor",
      "surfaceColor",
      "textColor",
      "textMuted",
      "borderColor",
    ]

    for (const key of colorKeys) {
      const val = settings[key] as string
      if (!val || !isHexColor(val)) {
        setError(t("admin.validation_invalid_color"))
        setToastErrorOpen(true)
        return false
      }
    }

    // Optional URLs when provided
    if (settings.logoUrl && !isValidUrl(settings.logoUrl)) {
      setError(t("admin.validation_invalid_url"))
      setToastErrorOpen(true)
      return false
    }
    if (settings.faviconUrl && !isValidUrl(settings.faviconUrl)) {
      setError(t("admin.validation_invalid_url"))
      setToastErrorOpen(true)
      return false
    }

    setError(null)
    return true
  }

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/settings")
      if (!response.ok) throw new Error("Failed to fetch settings")
      const data = await response.json()
      setSettings({
        appName: data.settings.appName || "SnowShare",
        appDescription: data.settings.appDescription || "Partagez vos fichiers, pastes et URLs en toute sécurité",
        logoUrl: data.settings.logoUrl || null,
        faviconUrl: data.settings.faviconUrl || null,
        primaryColor: data.settings.primaryColor || "#3B82F6",
        primaryHover: data.settings.primaryHover || "#2563EB",
        primaryDark: data.settings.primaryDark || "#1E40AF",
        secondaryColor: data.settings.secondaryColor || "#8B5CF6",
        secondaryHover: data.settings.secondaryHover || "#7C3AED",
        secondaryDark: data.settings.secondaryDark || "#6D28D9",
        backgroundColor: data.settings.backgroundColor || "#111827",
        surfaceColor: data.settings.surfaceColor || "#1F2937",
        textColor: data.settings.textColor || "#F9FAFB",
        textMuted: data.settings.textMuted || "#D1D5DB",
        borderColor: data.settings.borderColor || "#374151",
      })
      setError(null)
    } catch (err) {
      setError(t("admin.error_load_data"))
      setToastErrorOpen(true)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleChange = (key: keyof BrandingSettings, value: string | null) => {
    const newSettings = {
      ...settings,
      [key]: value,
    }
    setSettings(newSettings)
    
    // Live preview: update theme immediately for color changes
    if (key.includes("Color")) {
      updateTheme({
        [key]: value as string,
      })
    }
  }

  const handleSave = async () => {
    try {
      if (!validateSettingsBeforeSave()) return
      setSaving(true)
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!response.ok) throw new Error("Failed to save settings")
      
      // Update theme with new colors (live preview)
      updateTheme({
        primaryColor: settings.primaryColor,
        primaryHover: settings.primaryHover,
        primaryDark: settings.primaryDark,
        secondaryColor: settings.secondaryColor,
        secondaryHover: settings.secondaryHover,
        secondaryDark: settings.secondaryDark,
        backgroundColor: settings.backgroundColor,
        surfaceColor: settings.surfaceColor,
        textColor: settings.textColor,
        textMuted: settings.textMuted,
        borderColor: settings.borderColor,
      })

      // Show toast and refresh theme (metadata + favicon) without full reload
      setToastOpen(true)
      setError(null)
      await refreshSettings()
    } catch (err) {
      setError(t("admin.save_error"))
      setToastErrorOpen(true)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefaults = () => {
    setSettings({
      appName: "SnowShare",
      appDescription: "Partagez vos fichiers, pastes et URLs en toute sécurité",
      logoUrl: null,
      faviconUrl: null,
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
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          <p className="mt-2 text-[var(--foreground-muted)]">{t("admin.loading")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      <Snackbar
        open={toastOpen}
        autoHideDuration={1200}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert elevation={6} variant="filled" severity="success" sx={{ width: '100%' }}>
          {t("admin.save_success")}
        </MuiAlert>
      </Snackbar>

      <Snackbar
        open={toastErrorOpen}
        autoHideDuration={3000}
        onClose={() => setToastErrorOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert elevation={6} variant="filled" severity="error" sx={{ width: '100%' }}>
          {error || t("admin.save_error")}
        </MuiAlert>
      </Snackbar>

      {/* App Identity */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary-dark)]/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t("admin.branding.section_identity")}</h3>
        </div>

        <div className="space-y-4 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          {/* App Name */}
          <div>
            <label className="text-sm text-[var(--foreground)] block mb-2">{t("admin.branding.app_name")}</label>
            <input
              type="text"
              value={settings.appName}
              onChange={(e) => handleChange("appName", e.target.value)}
              className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="SnowShare"
            />
            <p className="text-xs text-[var(--foreground-muted)] mt-1">{t("admin.branding.app_name_hint")}</p>
          </div>

          {/* App Description */}
          <div>
            <label className="text-sm text-[var(--foreground)] block mb-2">{t("admin.branding.app_description")}</label>
            <textarea
              value={settings.appDescription}
              onChange={(e) => handleChange("appDescription", e.target.value)}
              className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
              rows={2}
              placeholder="Partagez vos fichiers, pastes et URLs en toute sécurité"
            />
            <p className="text-xs text-[var(--foreground-muted)] mt-1">{t("admin.branding.app_description_hint")}</p>
          </div>
        </div>
      </div>

      {/* Logo & Favicon */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--secondary)]/20 border border-[var(--secondary-dark)]/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t("admin.branding.section_images")}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Logo URL */}
          <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
            <label className="text-sm text-[var(--foreground)] block mb-2">{t("admin.branding.logo_url")}</label>
            <input
              type="url"
              value={settings.logoUrl || ""}
              onChange={(e) => handleChange("logoUrl", e.target.value || null)}
              className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-[var(--foreground-muted)] mt-1">{t("admin.branding.logo_url_hint")}</p>
            {settings.logoUrl && (
              <div className="mt-3 p-2 bg-[var(--surface)]/50 rounded-lg">
                <p className="text-xs text-[var(--foreground-muted)] mb-2">{t("admin.branding.preview")}</p>
                <Image
                  src={settings.logoUrl}
                  alt="Logo preview"
                  width={120}
                  height={40}
                  className="h-10 w-auto object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = "none"
                  }}
                />
              </div>
            )}
          </div>

          {/* Favicon URL */}
          <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
            <label className="text-sm text-[var(--foreground)] block mb-2">{t("admin.branding.favicon_url")}</label>
            <input
              type="url"
              value={settings.faviconUrl || ""}
              onChange={(e) => handleChange("faviconUrl", e.target.value || null)}
              className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="https://example.com/favicon.ico"
            />
            <p className="text-xs text-[var(--foreground-muted)] mt-1">{t("admin.branding.favicon_url_hint")}</p>
            {settings.faviconUrl && (
              <div className="mt-3 p-2 bg-[var(--surface)]/50 rounded-lg">
                <p className="text-xs text-[var(--foreground-muted)] mb-2">{t("admin.branding.preview")}</p>
                <Image
                  src={settings.faviconUrl}
                  alt="Favicon preview"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = "none"
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-green-600/20 border border-green-700/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t("admin.branding.section_colors")}</h3>
        </div>

        {/* Theme Presets */}
        <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <ThemePresetSelector
            onSelectPreset={(colors) => {
              setSettings({
                ...settings,
                ...colors,
              })
              // Apply preset immediately for live preview
              updateTheme(colors)
            }}
          />
        </div>

        {/* Primary Colors Group */}
        <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-4">{t("admin.branding.primary_colors")}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ColorInput
              label={t("admin.branding.primary_label")}
              value={settings.primaryColor}
              onChange={(v) => handleChange("primaryColor", v)}
              hint={t("admin.branding.primary_hint")}
            />
            <ColorInput
              label={t("admin.branding.primary_hover_label")}
              value={settings.primaryHover}
              onChange={(v) => handleChange("primaryHover", v)}
              hint={t("admin.branding.primary_hover_hint")}
            />
            <ColorInput
              label={t("admin.branding.primary_dark_label")}
              value={settings.primaryDark}
              onChange={(v) => handleChange("primaryDark", v)}
              hint={t("admin.branding.primary_dark_hint")}
            />
          </div>
        </div>

        {/* Secondary Colors Group */}
        <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-4">{t("admin.branding.secondary_colors")}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ColorInput
              label={t("admin.branding.secondary_label")}
              value={settings.secondaryColor}
              onChange={(v) => handleChange("secondaryColor", v)}
              hint={t("admin.branding.secondary_hint")}
            />
            <ColorInput
              label={t("admin.branding.secondary_hover_label")}
              value={settings.secondaryHover}
              onChange={(v) => handleChange("secondaryHover", v)}
              hint={t("admin.branding.secondary_hover_hint")}
            />
            <ColorInput
              label={t("admin.branding.secondary_dark_label")}
              value={settings.secondaryDark}
              onChange={(v) => handleChange("secondaryDark", v)}
              hint={t("admin.branding.secondary_dark_hint")}
            />
          </div>
        </div>

        {/* Background & Surface Colors */}
        <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-4">{t("admin.branding.background_surfaces")}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorInput
              label={t("admin.branding.background_label")}
              value={settings.backgroundColor}
              onChange={(v) => handleChange("backgroundColor", v)}
              hint={t("admin.branding.background_hint")}
            />
            <ColorInput
              label={t("admin.branding.surface_label")}
              value={settings.surfaceColor}
              onChange={(v) => handleChange("surfaceColor", v)}
              hint={t("admin.branding.surface_hint")}
            />
          </div>
        </div>

        {/* Text & Border Colors */}
        <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-4">{t("admin.branding.text_borders")}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ColorInput
              label={t("admin.branding.main_text_label")}
              value={settings.textColor}
              onChange={(v) => handleChange("textColor", v)}
              hint={t("admin.branding.main_text_hint")}
            />
            <ColorInput
              label={t("admin.branding.muted_text_label")}
              value={settings.textMuted}
              onChange={(v) => handleChange("textMuted", v)}
              hint={t("admin.branding.muted_text_hint")}
            />
            <ColorInput
              label={t("admin.branding.borders_label")}
              value={settings.borderColor}
              onChange={(v) => handleChange("borderColor", v)}
              hint={t("admin.branding.borders_hint")}
            />
          </div>
        </div>

        {/* Color Preview */}
        <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <p className="text-sm text-[var(--foreground)] mb-3">{t("admin.branding.theme_preview")}</p>
          <div
            className="p-6 rounded-lg space-y-4"
            style={{ backgroundColor: settings.backgroundColor }}
          >
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: settings.surfaceColor, borderColor: settings.borderColor, borderWidth: '1px' }}
            >
              <p style={{ color: settings.textColor }} className="font-medium">{t("admin.branding.preview_button_primary")}</p>
              <p style={{ color: settings.textMuted }} className="text-sm mt-1">{t("admin.branding.preview_button_accent")}</p>
              <div className="flex gap-3 mt-4">
                <button
                  className="px-4 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  {t("admin.branding.preview_button_primary")}
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: settings.secondaryColor }}
                >
                  {t("admin.branding.preview_button_accent")}
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-white font-medium"
                  style={{
                    background: `linear-gradient(to right, ${settings.primaryColor}, ${settings.secondaryColor})`,
                  }}
                >
                  {t("admin.branding.preview_button_gradient")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-[var(--primary)]/10 border border-[var(--primary-dark)]/30 rounded-lg text-[var(--primary-hover)] text-sm">
        <p className="font-medium mb-2">💡 {t("admin.branding.info_title")}</p>
        <ul className="space-y-1 text-xs">
          <li>• {t("admin.branding.info_1")}</li>
          <li>• {t("admin.branding.info_2")}</li>
          <li>• {t("admin.branding.info_3")}</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <button
          onClick={handleResetDefaults}
          className="px-4 py-2 bg-[var(--surface)]/50 hover:bg-[var(--surface)] text-[var(--foreground)] rounded-lg font-medium transition-all"
        >
          {t("admin.branding.reset_defaults")}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 text-white rounded-lg font-medium transition-all disabled:opacity-50"
          style={{ background: `linear-gradient(to right, ${settings.primaryColor}, ${settings.secondaryColor})` }}
        >
          {saving ? t("admin.settings.saving") : t("admin.settings.save")}
        </button>
      </div>
    </div>
  )
}

// Reusable component for color inputs
function ColorInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
}) {
  return (
    <div>
      <label className="text-xs text-[var(--foreground)] block mb-2">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-[var(--border)]/50 cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1.5 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-mono"
          placeholder="#000000"
        />
      </div>
      {hint && <p className="text-xs text-[var(--foreground-muted)] mt-1">{hint}</p>}
    </div>
  )
}
