"use client"

import { useState, useEffect } from "react"
import { signIn, getSession, getProviders, ClientSafeProvider } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslation } from "react-i18next"

export default function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")
  const { t } = useTranslation()

  useEffect(() => {
    (async () => {
      const res = await getProviders()
      setProviders(res)
    })()
  }, [])

  useEffect(() => {
    if (errorParam === "OAuthSignin") {
      setError(t('auth.error_oauth_signin', "Aucun email n'est associé à ce compte fournisseur."))
    } else if (errorParam && providers && providers[errorParam]) {
      // Auto-click if error param matches a provider ID (e.g. error=github)
      signIn(errorParam, { callbackUrl: "/" })
    }
  }, [errorParam, providers, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(t('auth.error_invalid_credentials'))
      } else {
        // Vérifier si la session est créée
        const session = await getSession()
        if (session) {
          router.push("/")
        }
      }
    } catch (error) {
      setError(t('auth.error_generic') + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] py-12 px-4 sm:px-6 lg:px-8">
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--foreground)]">
            {t('auth.signin_title')}
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--foreground-muted)]">
            {t('auth.signin_subtitle')}
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
                className="appearance-none relative block w-full px-3 py-3 border border-[var(--border)] placeholder-[var(--foreground-muted)] text-[var(--foreground)] bg-[var(--surface)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] focus:z-10 sm:text-sm transition-colors"
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
                autoComplete="current-password"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-[var(--border)] placeholder-[var(--foreground-muted)] text-[var(--foreground)] bg-[var(--surface)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] focus:z-10 sm:text-sm transition-colors"
                placeholder={t('auth.password_placeholder') as string}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('auth.signin_loading')}
                </div>
              ) : (
                t('auth.signin_button')
              )}
            </button>

            <div className="text-center">
              <Link
                href="/auth/signup"
                className="inline-flex items-center text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
              >
                {t('auth.no_account')}
              </Link>
            </div>
          </div>
        </form>

        {providers && Object.values(providers).filter((p: ClientSafeProvider) => p.name !== "credentials").length > 0 && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[var(--background)] text-[var(--foreground-muted)]">
                  {t('auth.or_continue_with', 'Or continue with')}
                </span>
              </div>
            </div>

            <div className="grid gap-3">
              {Object.values(providers).filter((p: ClientSafeProvider) => p.name !== "credentials").map((provider: ClientSafeProvider) => (
                <button
                  key={provider.name}
                  onClick={() => signIn(provider.id, { callbackUrl: "/" })}
                  className="flex items-center justify-center w-full px-4 py-3 border border-[var(--border)] rounded-md shadow-sm bg-[var(--surface)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors capitalize"
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
