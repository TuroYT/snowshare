"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"

interface Settings {
  id: number
  allowSignin: boolean
  anoMaxUpload: number
  authMaxUpload: number
  anoIpQuota: number
  authIpQuota: number
}

export default function SettingsTab() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
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
  }

  const handleToggle = (key: keyof Settings) => {
    if (settings && typeof settings[key] === "boolean") {
      setSettings({
        ...settings,
        [key]: !settings[key],
      })
    }
  }

  const handleChange = (key: keyof Settings, value: any) => {
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

      if (!response.ok) throw new Error("Failed to save settings")
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
          <p className="mt-2 text-gray-400">{t("admin.loading")}</p>
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

      {/* General Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-100">{t("admin.settings.section_general")}</h3>
        
        <div className="flex items-center justify-between p-4 bg-gray-700/20 rounded-lg border border-gray-700/50">
          <div>
            <label className="text-gray-200 font-medium">{t("admin.settings.allow_signup")}</label>
            <p className="text-sm text-gray-400 mt-1">{t("admin.settings.allow_signup_desc")}</p>
          </div>
          <button
            onClick={() => handleToggle("allowSignin")}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              settings.allowSignin ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                settings.allowSignin ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Upload Quotas */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-700/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-100">{t("admin.quotas.title")}</h3>
        </div>

        {/* Anonymous Users */}
        <div className="space-y-3 p-4 bg-gray-700/20 rounded-lg border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 rounded-lg bg-blue-600/20 border border-blue-700/50 flex items-center justify-center">
              <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <label className="text-gray-200 font-medium">{t("admin.quotas.section_anonymous")}</label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-300">{t("admin.quotas.max_file_size")}</label>
              <p className="text-xs text-gray-500 mb-2">{t("admin.quotas.max_file_size_hint")}</p>
              <div className="relative">
                <input
                  type="number"
                  value={settings.anoMaxUpload}
                  onChange={(e) => handleChange("anoMaxUpload", parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">MB</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t("admin.quotas.current_value", { value: settings.anoMaxUpload })}
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-300">{t("admin.quotas.ip_quota")}</label>
              <p className="text-xs text-gray-500 mb-2">{t("admin.quotas.ip_quota_hint")}</p>
              <div className="relative">
                <input
                  type="number"
                  value={settings.anoIpQuota}
                  onChange={(e) => handleChange("anoIpQuota", parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">MB</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t("admin.quotas.current_value", { value: settings.anoIpQuota })}
              </p>
            </div>
          </div>
        </div>

        {/* Authenticated Users */}
        <div className="space-y-3 p-4 bg-gray-700/20 rounded-lg border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 rounded-lg bg-purple-600/20 border border-purple-700/50 flex items-center justify-center">
              <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <label className="text-gray-200 font-medium">{t("admin.quotas.section_authenticated")}</label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-300">{t("admin.quotas.max_file_size")}</label>
              <p className="text-xs text-gray-500 mb-2">{t("admin.quotas.max_file_size_hint")}</p>
              <div className="relative">
                <input
                  type="number"
                  value={settings.authMaxUpload}
                  onChange={(e) => handleChange("authMaxUpload", parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">MB</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t("admin.quotas.current_value", { value: settings.authMaxUpload })}
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-300">{t("admin.quotas.ip_quota")}</label>
              <p className="text-xs text-gray-500 mb-2">{t("admin.quotas.ip_quota_hint")}</p>
              <div className="relative">
                <input
                  type="number"
                  value={settings.authIpQuota}
                  onChange={(e) => handleChange("authIpQuota", parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">MB</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t("admin.quotas.current_value", { value: settings.authIpQuota })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-600/10 border border-blue-700/30 rounded-lg text-blue-300 text-sm">
        <p className="font-medium mb-2">💡 Info</p>
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
          {saving ? t("admin.settings.saving") : t("admin.settings.save")}
        </button>
      </div>
    </div>
  )
}
