"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import MDEditor from "@uiw/react-md-editor"
import { Snackbar, Alert } from "@mui/material"

interface Settings {
  id: number
  allowSignin: boolean
  disableCredentialsLogin: boolean
  allowAnonFileShare: boolean
  anoMaxUpload: number
  authMaxUpload: number
  anoIpQuota: number
  authIpQuota: number
  termsOfUses: string
}

export default function SettingsTab() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [hasActiveSSO, setHasActiveSSO] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success")

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/settings")
      if (!response.ok) throw new Error("Failed to fetch settings")
      const data = await response.json()
      setHasActiveSSO(data.hasActiveSSO)
      // Ensure all boolean fields have default values
      setSettings({
        ...data.settings,
        allowSignin: data.settings.allowSignin ?? true,
        disableCredentialsLogin: data.settings.disableCredentialsLogin ?? false,
        allowAnonFileShare: data.settings.allowAnonFileShare ?? true,
      })
    } catch (err) {
      setToastMessage(t("admin.error_load_data"))
      setToastSeverity("error")
      setToastOpen(true)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleToggle = (key: keyof Settings) => {
    if (settings && typeof settings[key] === "boolean") {
      setSettings({
        ...settings,
        [key]: !settings[key],
      })
    }
  }

  const handleChange = (key: keyof Settings, value: number) => {
    if (settings) {
      setSettings({
        ...settings,
        [key]: value,
      })
    }
  }

  const handleMarkdownChange = (value: string | undefined) => {
    if (settings) {
      setSettings({
        ...settings,
        termsOfUses: value || "",
      })
    }
  }

  const handleToastClose = () => {
    setToastOpen(false)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!response.ok) throw new Error("Failed to save settings")
      const data = await response.json()
      setSettings(data.settings)
      setToastMessage(t("admin.save_success"))
      setToastSeverity("success")
      setToastOpen(true)
    } catch (err) {
      setToastMessage(t("admin.save_error"))
      setToastSeverity("error")
      setToastOpen(true)
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
    <div className="space-y-6 w-full">
      {/* Toast Notifications */}
      <Snackbar open={toastOpen} autoHideDuration={3000} onClose={handleToastClose}>
        <Alert onClose={handleToastClose} severity={toastSeverity} sx={{ width: "100%" }}>
          {toastMessage}
        </Alert>
      </Snackbar>

      {/* General Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">{t("admin.settings.section_general")}</h3>
        
        <div className="flex items-center justify-between p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div>
            <label className="text-[var(--foreground)] font-medium">{t("admin.settings.allow_signup")}</label>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">{t("admin.settings.allow_signup_desc")}</p>
          </div>
          <button
            onClick={() => handleToggle("allowSignin")}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              settings.allowSignin ? "bg-[var(--primary)]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                settings.allowSignin ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div>
            <label className="text-[var(--foreground)] font-medium">{t("admin.settings.disable_credentials_login")}</label>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">{t("admin.settings.disable_credentials_login_desc")}</p>
            {!hasActiveSSO && (
              <p className="text-xs text-red-400 mt-1">{t("admin.settings.no_sso_active")}</p>
            )}
          </div>
          <button
            disabled={!hasActiveSSO}
            onClick={() => handleToggle("disableCredentialsLogin")}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              settings.disableCredentialsLogin ? "bg-[var(--primary)]" : "bg-gray-600"
            } ${!hasActiveSSO ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                settings.disableCredentialsLogin ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div>
            <label className="text-[var(--foreground)] font-medium">{t("admin.settings.allow_anon_fileshare")}</label>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">{t("admin.settings.allow_anon_fileshare_desc")}</p>
          </div>
          <button
            onClick={() => handleToggle("allowAnonFileShare")}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              settings.allowAnonFileShare ? "bg-[var(--primary)]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                settings.allowAnonFileShare ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Upload Quotas */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary-dark)]/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t("admin.quotas.title")}</h3>
        </div>

        {/* Anonymous Users */}
        <div className="space-y-3 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary-dark)]/50 flex items-center justify-center">
              <svg className="w-3 h-3 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <label className="text-[var(--foreground)] font-medium">{t("admin.quotas.section_anonymous")}</label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[var(--foreground)]">{t("admin.quotas.max_file_size")}</label>
              <p className="text-xs text-[var(--foreground-muted)] mb-2">{t("admin.quotas.max_file_size_hint")}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={settings.anoMaxUpload}
                    onChange={(e) => handleChange("anoMaxUpload", parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    min="0"
                  />
                </div>
                <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">MB</span>
              </div>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {t("admin.quotas.current_value", { value: settings.anoMaxUpload })}
              </p>
            </div>

            <div>
              <label className="text-sm text-[var(--foreground)]">{t("admin.quotas.ip_quota")}</label>
              <p className="text-xs text-[var(--foreground-muted)] mb-2">{t("admin.quotas.ip_quota_hint")}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={settings.anoIpQuota}
                    onChange={(e) => handleChange("anoIpQuota", parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    min="0"
                  />
                </div>
                <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">MB</span>
              </div>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {t("admin.quotas.current_value", { value: settings.anoIpQuota })}
              </p>
            </div>
          </div>
        </div>

        {/* Authenticated Users */}
        <div className="space-y-3 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 rounded-lg bg-[var(--secondary)]/20 border border-[var(--secondary-dark)]/50 flex items-center justify-center">
              <svg className="w-3 h-3 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <label className="text-[var(--foreground)] font-medium">{t("admin.quotas.section_authenticated")}</label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[var(--foreground)]">{t("admin.quotas.max_file_size")}</label>
              <p className="text-xs text-[var(--foreground-muted)] mb-2">{t("admin.quotas.max_file_size_hint")}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={settings.authMaxUpload}
                    onChange={(e) => handleChange("authMaxUpload", parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    min="0"
                  />
                </div>
                <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">MB</span>
              </div>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {t("admin.quotas.current_value", { value: settings.authMaxUpload })}
              </p>
            </div>

            <div>
              <label className="text-sm text-[var(--foreground)]">{t("admin.quotas.ip_quota")}</label>
              <p className="text-xs text-[var(--foreground-muted)] mb-2">{t("admin.quotas.ip_quota_hint")}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={settings.authIpQuota}
                    onChange={(e) => handleChange("authIpQuota", parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    min="0"
                  />
                </div>
                <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">MB</span>
              </div>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {t("admin.quotas.current_value", { value: settings.authIpQuota })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-[var(--primary)]/10 border border-[var(--primary-dark)]/30 rounded-lg text-[var(--primary-hover)] text-sm">
        <p className="font-medium mb-2">💡 Info</p>
        <ul className="space-y-1 text-xs">
          <li>• {t("admin.quotas.max_file_size_hint")}</li>
          <li>• {t("admin.quotas.ip_quota_hint")}</li>
        </ul>
      </div>

      {/* Markdown Editor for Terms of Use */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          {t("footer.terms_of_use")}
        </h3>
        <MDEditor
          value={settings?.termsOfUses || ""}
          onChange={handleMarkdownChange}
          height={300}
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 text-white rounded-lg font-medium transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(to right, var(--primary), var(--secondary))' }}
        >
          {saving ? t("admin.settings.saving") : t("admin.settings.save")}
        </button>
      </div>
    </div>
  )
}
