"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useTranslation } from "react-i18next"

export default function PrivateLinkPage() {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const params = useParams()
  const slug = params?.slug as string

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/l/${slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug,
          password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || t("link_private.error_generic"))
        return
      }

      if (data.url) {
        // Rediriger vers l'URL décryptée
        window.location.href = data.url
      } else {
        setError(t("link_private.error_url_not_found"))
      }
    } catch {
      setError(t("link_private.error_connection"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-900/20 border border-blue-800">
            <svg 
              className="h-8 w-8 text-[var(--primary)]" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--foreground)]">
            {t("link_private.title")}
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--foreground-muted)]">
            {t("link_private.subtitle")}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              {t("link_private.password_label")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="appearance-none relative block w-full px-3 py-3 border border-[var(--border)] placeholder-[var(--foreground-muted)] text-[var(--foreground)] bg-[var(--surface)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] focus:z-10 sm:text-sm transition-colors"
              placeholder={t("link_private.password_placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-800 rounded-md p-3">
              <div className="flex items-center justify-center">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t("link_private.verifying")}
                </div>
              ) : (
                t("link_private.access_link")
              )}
            </button>

            <div className="text-center">
              <Link
                href="/"
                className="inline-flex items-center text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t("link_private.back_home")}
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-[var(--foreground-muted)]">
          <p>
            {t("link_private.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  )
}
