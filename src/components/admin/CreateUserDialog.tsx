"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"

interface CreateUserDialogProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
}

export default function CreateUserDialog({
  isOpen,
  onClose,
  onUserCreated,
}: CreateUserDialogProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          password,
          isAdmin,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create user")
      }

      // Reset form and close dialog
      setEmail("")
      setName("")
      setPassword("")
      setIsAdmin(false)
      onUserCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--background)] border border-[var(--border)]/50 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
          {t("admin.users.create_user")}
        </h2>

        {error && (
          <div className="bg-red-600/10 border border-red-700/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              {t("admin.users.email")} *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("admin.users.email_placeholder")}
              className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              required
              disabled={loading}
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              {t("admin.users.name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("admin.users.name_placeholder")}
              className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              {t("admin.users.password")} *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("admin.users.password_placeholder")}
              className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              required
              disabled={loading}
            />
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              {t("admin.users.password_hint")}
            </p>
          </div>

          {/* Admin checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isAdmin"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface)]/50 cursor-pointer"
              disabled={loading}
            />
            <label htmlFor="isAdmin" className="text-sm text-[var(--foreground)] cursor-pointer">
              {t("admin.users.make_admin")}
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[var(--surface)]/50 hover:bg-[var(--surface)] border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] font-medium transition-colors disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? t("admin.users.creating") : t("admin.users.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
