"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { signIn, SignInResponse } from "next-auth/react"

export default function Setup() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const { t } = useTranslation()

  useEffect(() => {
    // Check if setup is actually needed
    const checkSetupStatus = async () => {
      try {
        const response = await fetch("/api/setup/check")
        const data = await response.json()

        if (!data.needsSetup) {
          // Setup not needed, redirect to home
          router.push("/")
        } else {
          setChecking(false)
        }
      } catch {
        setChecking(false)
      }
    }

    checkSetupStatus()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (password !== confirmPassword) {
      setError(t('auth.error_passwords_mismatch'))
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError(t('auth.error_password_too_short'))
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, isFirstUser: true }),
      })

      const data = await response.json()

      if (response.ok) {
        const signInResult = (await signIn("credentials", {
          redirect: false,
          email,
          password,
        })) as SignInResponse | undefined

        if (signInResult?.ok) {
          // Redirect to home after successful sign-in
          router.push("/")
        } else {
          // If auto-login failed, redirect to sign-in with a message
          router.push(`/auth/signin?message=${encodeURIComponent(t('auth.success_account_created'))}`)
        }
      } else {
        setError(data.error || t('auth.error_generic').replace(' : ', ''))
      }
    } catch {
      setError(t('auth.error_generic').replace(' : ', ''))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-[var(--foreground-muted)]" suppressHydrationWarning>{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-blue-900/20 border-2 border-blue-800">
            <svg
              className="h-10 w-10 text-[var(--primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
            {t('setup.title')}
          </h2>
          <p className="mt-3 text-center text-base text-[var(--foreground)] max-w-md mx-auto">
            {t('setup.description')}
          </p>
          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
            <p className="text-sm text-[var(--primary-hover)]">
              <svg className="inline h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              {t('setup.info')}
            </p>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                {t('auth.email_label')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                className="appearance-none relative block w-full px-4 py-3 border border-[var(--border)] placeholder-[var(--foreground-muted)] text-[var(--foreground)] bg-[var(--surface)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] sm:text-sm transition-all"
                placeholder={t('auth.email_placeholder') as string}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                {t('auth.password_label')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none relative block w-full px-4 py-3 border border-[var(--border)] placeholder-[var(--foreground-muted)] text-[var(--foreground)] bg-[var(--surface)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] sm:text-sm transition-all"
                placeholder={t('auth.password_new_placeholder') as string}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                {t('auth.confirm_password_label')}
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none relative block w-full px-4 py-3 border border-[var(--border)] placeholder-[var(--foreground-muted)] text-[var(--foreground)] bg-[var(--surface)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] sm:text-sm transition-all"
                placeholder={t('auth.confirm_password_placeholder') as string}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-800 rounded-lg p-3">
              <div className="flex items-center justify-center">
                <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('setup.creating')}
                </div>
              ) : (
                t('setup.submit')
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-[var(--foreground-muted)]">
          <p>
            {t('setup.admin_notice')}
          </p>
        </div>
      </div>
    </div>
  )
}
