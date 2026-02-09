"use client"

import { useState, useEffect } from "react"
import { signIn, type SignInResponse } from "next-auth/react"
import { redirect, useRouter } from "next/navigation"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { useBranding } from "@/components/BrandingProvider"

export default function SignUp() {
  const [email, setEmail] = useState("")
  const { branding } = useBranding()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [allowSignup, setAllowSignup] = useState(true)
  const [disableCredentialsLogin, setDisableCredentialsLogin] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const router = useRouter()
  const { t } = useTranslation()

  // Check signup status from database
  useEffect(() => {
    const fetchSignupStatus = async () => {
      try {
        const response = await fetch("/api/setup/check")
        if (response.ok) {
          const data = await response.json()
          setAllowSignup(data.allowSignup ?? true)
          setDisableCredentialsLogin(data.disableCredentialsLogin ?? false)
        }
      } catch (error) {
        console.error("Error fetching signup status:", error)
        setAllowSignup(true) // Default to true on error
      } finally {
        setCheckingStatus(false)
      }
    }

    fetchSignupStatus()
  }, [])

  // Show loading state while checking signup status
  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-[var(--foreground-muted)]" suppressHydrationWarning>{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (disableCredentialsLogin) {
    redirect("/auth/signin")
  }

  // Redirect to signin if signup is disabled
  if (!allowSignup) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-900/20 border border-red-800">
            <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--foreground)]">
            {t('auth.signup_disabled_title', 'Inscription désactivée')}
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--foreground-muted)]">
            {t('auth.signup_disabled_message', 'Les nouvelles inscriptions ne sont actuellement pas autorisées.')}
          </p>
          <div className="mt-6">
            <Link
              href="/auth/signin"
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] transition-colors"
            >
              {t('nav.signin')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        // Auto-login after successful registration using NextAuth credentials provider
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

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="flex justify-start mb-6">
          <Link
            href="/"
            className="flex items-center text-sm text-[var(--foreground-muted)] hover:text-[var(--primary)] transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('auth.return_to_main_page')}
          </Link>
        </div>
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-900/20 border border-green-800">
            <svg 
              className="h-8 w-8 text-green-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" 
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--foreground)]">
            {t('auth.signup_title')}
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--foreground-muted)]">
            {t('auth.signup_subtitle', { appName: branding.appName })}
          </p>
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
                className="appearance-none relative block w-full px-3 py-3 border border-[var(--border)] placeholder-[var(--foreground-muted)] text-[var(--foreground)] bg-[var(--surface)] rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm transition-colors"
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
                className="appearance-none relative block w-full px-3 py-3 border border-[var(--border)] placeholder-[var(--foreground-muted)] text-[var(--foreground)] bg-[var(--surface)] rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm transition-colors"
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
                className="appearance-none relative block w-full px-3 py-3 border border-[var(--border)] placeholder-[var(--foreground-muted)] text-[var(--foreground)] bg-[var(--surface)] rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm transition-colors"
                placeholder={t('auth.confirm_password_placeholder') as string}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
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
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('auth.signup_loading')}
                </div>
              ) : (
                t('auth.signup_button')
              )}
            </button>

            <div className="text-center">
              <Link
                href="/auth/signin"
                className="inline-flex items-center text-sm text-green-400 hover:text-green-300 transition-colors"
              >
                {t('auth.already_account')}
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-[var(--foreground-muted)]">
          <p>
            {t('auth.terms_notice')}{' '}
            <Link href="/terms-of-use" className="text-[var(--primary)] hover:underline">
              {t('footer.terms_of_use', 'Terms of Use')}
            </Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
