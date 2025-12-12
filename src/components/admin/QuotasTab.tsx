"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"

interface Settings {
  id: number
  anoMaxUpload: number
  authMaxUpload: number
  anoIpQuota: number
  authIpQuota: number
}

export default function QuotasTab() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/settings")
      if (!response.ok) throw new Error("Failed to fetch settings")
      const data = await response.json()
      setSettings(data.settings)
      setError(null)
    } catch (err) {
      setError(t("admin.error_load_data"))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleChange = (key: keyof Settings, value: number) => {
    if (settings) {
      setSettings({
        ...settings,
        [key]: value,
      })
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!response.ok) throw new Error("Failed to save quotas")
      const data = await response.json()
      setSettings(data.settings)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      setError(null)
    } catch (err) {
      setError(t("admin.save_error"))
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-[var(--foreground-muted)]">{t("admin.loading")}</p>
        </div>
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="space-y-6 max-w-4xl">
      {error && (
        <div className="bg-red-600/10 border border-red-700/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-600/10 border border-green-700/30 rounded-xl p-4 text-green-400">
          {t("admin.save_success")}
        </div>
      )}

      {/* Anonymous Users Quotas */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary-dark)]/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t("admin.quotas.section_anonymous")}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div>
            <label className="text-[var(--foreground)] font-medium">{t("admin.quotas.max_file_size")}</label>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">{t("admin.quotas.max_file_size_hint")}</p>
            <div className="relative mt-2">
              <input
                type="number"
                value={settings.anoMaxUpload}
                onChange={(e) => handleChange("anoMaxUpload", parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                min="0"
              />
              <span className="absolute right-3 top-2 text-[var(--foreground-muted)] text-sm">MB</span>
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-2">
              {t("admin.quotas.current_value", { value: settings.anoMaxUpload })}
            </p>
          </div>

          <div>
            <label className="text-[var(--foreground)] font-medium">{t("admin.quotas.ip_quota")}</label>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">{t("admin.quotas.ip_quota_hint")}</p>
            <div className="relative mt-2">
              <input
                type="number"
                value={settings.anoIpQuota}
                onChange={(e) => handleChange("anoIpQuota", parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                min="0"
              />
              <span className="absolute right-3 top-2 text-[var(--foreground-muted)] text-sm">MB</span>
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-2">
              {t("admin.quotas.current_value", { value: settings.anoIpQuota })}
            </p>
          </div>
        </div>
      </div>

      {/* Authenticated Users Quotas */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--secondary)]/20 border border-[var(--secondary-dark)]/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t("admin.quotas.section_authenticated")}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div>
            <label className="text-[var(--foreground)] font-medium">{t("admin.quotas.max_file_size")}</label>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">{t("admin.quotas.max_file_size_hint")}</p>
            <div className="relative mt-2">
              <input
                type="number"
                value={settings.authMaxUpload}
                onChange={(e) => handleChange("authMaxUpload", parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                min="0"
              />
              <span className="absolute right-3 top-2 text-[var(--foreground-muted)] text-sm">MB</span>
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-2">
              {t("admin.quotas.current_value", { value: settings.authMaxUpload })}
            </p>
          </div>

          <div>
            <label className="text-[var(--foreground)] font-medium">{t("admin.quotas.ip_quota")}</label>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">{t("admin.quotas.ip_quota_hint")}</p>
            <div className="relative mt-2">
              <input
                type="number"
                value={settings.authIpQuota}
                onChange={(e) => handleChange("authIpQuota", parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                min="0"
              />
              <span className="absolute right-3 top-2 text-[var(--foreground-muted)] text-sm">MB</span>
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-2">
              {t("admin.quotas.current_value", { value: settings.authIpQuota })}
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-[var(--primary)]/10 border border-[var(--primary-dark)]/30 rounded-lg text-[var(--primary-hover)] text-sm">
        <p className="font-medium mb-1">💡 Info</p>
        <ul className="space-y-1 text-xs">
          <li>• {t("admin.quotas.max_file_size_hint")}</li>
          <li>• {t("admin.quotas.ip_quota_hint")}</li>
        </ul>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all disabled:opacity-50"
        >
          {saving ? t("admin.quotas.saving") : t("admin.quotas.save")}
        </button>
      </div>
    </div>
  )
}
