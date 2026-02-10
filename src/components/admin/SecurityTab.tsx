"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Snackbar, Alert } from "@mui/material"
import SecurityWarningModal from "@/components/admin/SecurityWarningModal"

interface SecuritySettings {
  requireEmailVerification: boolean
  smtpHost: string | null
  smtpPort: number | null
  smtpSecure: boolean
  smtpUser: string | null
  smtpPassword: string | null
  smtpFromEmail: string | null
  smtpFromName: string | null
  captchaEnabled: boolean
  captchaProvider: string | null
  captchaSiteKey: string | null
  captchaSecretKey: string | null
}

export default function SecurityTab() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<SecuritySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [testingCaptcha, setTestingCaptcha] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success")
  const [warningModalOpen, setWarningModalOpen] = useState(false)
  const [warningModalType, setWarningModalType] = useState<"captcha" | "email">("captcha")
  const [pendingToggle, setPendingToggle] = useState<keyof SecuritySettings | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/security")
      if (!response.ok) throw new Error("Failed to fetch security settings")
      const data = await response.json()
      setSettings(data)
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

  const handleToggle = (key: keyof SecuritySettings) => {
    if (settings && typeof settings[key] === "boolean") {
      // Show warning modal before enabling captcha or email verification
      if ((key === "captchaEnabled" || key === "requireEmailVerification") && !settings[key]) {
        setWarningModalType(key === "captchaEnabled" ? "captcha" : "email")
        setPendingToggle(key)
        setWarningModalOpen(true)
        return
      }
      
      setSettings({
        ...settings,
        [key]: !settings[key],
      })
    }
  }

  const handleWarningConfirm = () => {
    if (pendingToggle && settings) {
      setSettings({
        ...settings,
        [pendingToggle]: !settings[pendingToggle],
      })
    }
    setWarningModalOpen(false)
    setPendingToggle(null)
  }

  const handleWarningCancel = () => {
    setWarningModalOpen(false)
    setPendingToggle(null)
  }

  const handleChange = (key: keyof SecuritySettings, value: string | number | boolean | null) => {
    if (settings) {
      setSettings({
        ...settings,
        [key]: value,
      })
    }
  }

  const handleToastClose = () => {
    setToastOpen(false)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch("/api/admin/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!response.ok) throw new Error("Failed to save security settings")
      const data = await response.json()
      setSettings(data)
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

  const handleTestEmail = async () => {
    if (!testEmail) {
      setToastMessage(t("security.test_email.error_no_address"))
      setToastSeverity("error")
      setToastOpen(true)
      return
    }

    try {
      setTestingEmail(true)
      const response = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t("security.test_email.error_failed"))
      }

      setToastMessage(t("security.test_email.success"))
      setToastSeverity("success")
      setToastOpen(true)
      setTestEmail("")
    } catch (err) {
      const error = err as Error
      setToastMessage(error.message || t("security.test_email.error_failed"))
      setToastSeverity("error")
      setToastOpen(true)
      console.error(err)
    } finally {
      setTestingEmail(false)
    }
  }

  const handleTestCaptcha = async () => {
    if (!settings?.captchaProvider || !settings?.captchaSiteKey || !settings?.captchaSecretKey) {
      setToastMessage(t("security.test_captcha.error_config"))
      setToastSeverity("error")
      setToastOpen(true)
      return
    }

    try {
      setTestingCaptcha(true)
      const response = await fetch("/api/admin/test-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.captchaProvider,
          siteKey: settings.captchaSiteKey,
          secretKey: settings.captchaSecretKey,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || t("security.test_captcha.error_failed"))
      }

      setToastMessage(data.message || t("security.test_captcha.success"))
      setToastSeverity("success")
      setToastOpen(true)
    } catch (err) {
      const error = err as Error
      setToastMessage(error.message || t("security.test_captcha.error_failed"))
      setToastSeverity("error")
      setToastOpen(true)
      console.error(err)
    } finally {
      setTestingCaptcha(false)
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
      <Snackbar open={toastOpen} autoHideDuration={3000} onClose={handleToastClose}>
        <Alert onClose={handleToastClose} severity={toastSeverity} sx={{ width: "100%" }}>
          {toastMessage}
        </Alert>
      </Snackbar>

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary-dark)]/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Email Verification</h3>
        </div>

        <div className="flex items-center justify-between p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div>
            <label className="text-[var(--foreground)] font-medium">Require Email Verification</label>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              Require new users to verify their email address before they can sign in
            </p>
          </div>
          <button
            onClick={() => handleToggle("requireEmailVerification")}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              settings.requireEmailVerification ? "bg-[var(--primary)]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                settings.requireEmailVerification ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--secondary)]/20 border border-[var(--secondary-dark)]/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">SMTP Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div>
            <label className="text-sm text-[var(--foreground)] font-medium">SMTP Host</label>
            <input
              type="text"
              value={settings.smtpHost || ""}
              onChange={(e) => handleChange("smtpHost", e.target.value || null)}
              className="mt-1 w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="smtp.gmail.com"
            />
          </div>

          <div>
            <label className="text-sm text-[var(--foreground)] font-medium">SMTP Port</label>
            <input
              type="number"
              value={settings.smtpPort || ""}
              onChange={(e) => handleChange("smtpPort", e.target.value ? parseInt(e.target.value) : null)}
              className="mt-1 w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="587"
            />
          </div>

          <div>
            <label className="text-sm text-[var(--foreground)] font-medium">SMTP Username</label>
            <input
              type="text"
              value={settings.smtpUser || ""}
              onChange={(e) => handleChange("smtpUser", e.target.value || null)}
              className="mt-1 w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="your-email@gmail.com"
            />
          </div>

          <div>
            <label className="text-sm text-[var(--foreground)] font-medium">SMTP Password</label>
            <input
              type="password"
              value={settings.smtpPassword || ""}
              onChange={(e) => handleChange("smtpPassword", e.target.value || null)}
              className="mt-1 w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="********"
            />
          </div>

          <div>
            <label className="text-sm text-[var(--foreground)] font-medium">From Email</label>
            <input
              type="email"
              value={settings.smtpFromEmail || ""}
              onChange={(e) => handleChange("smtpFromEmail", e.target.value || null)}
              className="mt-1 w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="noreply@snowshare.local"
            />
          </div>

          <div>
            <label className="text-sm text-[var(--foreground)] font-medium">From Name</label>
            <input
              type="text"
              value={settings.smtpFromName || ""}
              onChange={(e) => handleChange("smtpFromName", e.target.value || null)}
              className="mt-1 w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="SnowShare"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="smtpSecure"
                checked={settings.smtpSecure}
                onChange={(e) => handleChange("smtpSecure", e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="smtpSecure" className="text-sm text-[var(--foreground)]">
                Use SSL/TLS (recommended for port 465)
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 bg-[var(--primary)]/10 border border-[var(--primary-dark)]/30 rounded-lg">
          <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">Test SMTP Configuration</h4>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1 px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="test@example.com"
            />
            <button
              onClick={handleTestEmail}
              disabled={testingEmail}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg font-medium transition-all disabled:opacity-50 hover:bg-[var(--primary-hover)]"
            >
              {testingEmail ? t("security.test_email.button_sending") : t("security.test_email.button_send")}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary-dark)]/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">CAPTCHA Protection</h3>
        </div>

        <div className="flex items-center justify-between p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div>
            <label className="text-[var(--foreground)] font-medium">Enable CAPTCHA</label>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              Protect registration with CAPTCHA to prevent automated bot signups
            </p>
          </div>
          <button
            onClick={() => handleToggle("captchaEnabled")}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              settings.captchaEnabled ? "bg-[var(--primary)]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                settings.captchaEnabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {settings.captchaEnabled && (
          <div className="space-y-4 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
            <div>
              <label className="text-sm text-[var(--foreground)] font-medium">CAPTCHA Provider</label>
              <select
                value={settings.captchaProvider || ""}
                onChange={(e) => handleChange("captchaProvider", e.target.value || null)}
                className="mt-1 w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="">Select a provider</option>
                <option value="recaptcha-v2">Google reCAPTCHA v2</option>
                <option value="recaptcha-v3">Google reCAPTCHA v3</option>
                <option value="turnstile">Cloudflare Turnstile</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-[var(--foreground)] font-medium">Site Key</label>
              <input
                type="text"
                value={settings.captchaSiteKey || ""}
                onChange={(e) => handleChange("captchaSiteKey", e.target.value || null)}
                className="mt-1 w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="Your public site key"
              />
            </div>

            <div>
              <label className="text-sm text-[var(--foreground)] font-medium">Secret Key</label>
              <input
                type="password"
                value={settings.captchaSecretKey || ""}
                onChange={(e) => handleChange("captchaSecretKey", e.target.value || null)}
                className="mt-1 w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="********"
              />
            </div>

            <div className="p-3 bg-[var(--primary)]/10 border border-[var(--primary-dark)]/30 rounded-lg text-sm text-[var(--foreground)]">
              <p className="font-medium mb-1">💡 Setup Instructions</p>
              <ul className="space-y-1 text-xs text-[var(--foreground-muted)]">
                <li>• <strong>Google reCAPTCHA:</strong> Get keys from <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">Google reCAPTCHA Admin</a></li>
                <li>• <strong>Cloudflare Turnstile:</strong> Get keys from <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">Cloudflare Dashboard</a></li>
              </ul>
            </div>

            <div className="p-4 bg-[var(--secondary)]/10 border border-[var(--secondary-dark)]/30 rounded-lg">
              <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">{t("security.test_captcha.title")}</h4>
              <p className="text-xs text-[var(--foreground-muted)] mb-3">
                {t("security.test_captcha.description")}
              </p>
              <button
                onClick={handleTestCaptcha}
                disabled={testingCaptcha || !settings.captchaProvider || !settings.captchaSiteKey || !settings.captchaSecretKey}
                className="w-full px-4 py-2 bg-[var(--secondary)] text-white rounded-lg font-medium transition-all disabled:opacity-50 hover:bg-[var(--secondary-hover)]"
              >
                {testingCaptcha ? t("security.test_captcha.button_testing") : t("security.test_captcha.button_test")}
              </button>
            </div>
          </div>
        )}
      </div>

      <SecurityWarningModal
        open={warningModalOpen}
        type={warningModalType}
        onConfirm={handleWarningConfirm}
        onClose={handleWarningCancel}
      />

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
