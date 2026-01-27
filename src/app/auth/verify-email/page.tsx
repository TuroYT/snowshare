"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslation } from "react-i18next"

function VerifyEmailContent() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [error, setError] = useState("")
  const [resendEmail, setResendEmail] = useState("")
  const [resending, setResending] = useState(false)
  const router = useRouter()
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setError(t("auth.verification_token_missing"))
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (response.ok) {
          setStatus("success")
          // Redirect to signin after 3 seconds
          setTimeout(() => {
            router.push("/auth/signin?message=" + encodeURIComponent(t("auth.verification_success_message")))
          }, 3000)
        } else {
          setStatus("error")
          setError(data.error || t("auth.verification_failed_message"))
        }
      } catch (err) {
        setStatus("error")
        setError(t("auth.verification_error"))
        console.error(err)
      }
    }

    verifyEmail()
  }, [token, router, t])

  const handleResendVerification = async () => {
    if (!resendEmail) {
      setError(t("auth.enter_email_prompt"))
      return
    }

    try {
      setResending(true)
      const response = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: resendEmail }),
      })

      const data = await response.json()

      if (response.ok) {
        setError("")
        alert(t("auth.resend_success"))
        setResendEmail("")
      } else {
        setError(data.error || t("auth.resend_failed"))
      }
    } catch (err) {
      setError(t("auth.resend_error"))
      console.error(err)
    } finally {
      setResending(false)
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

        {/* Verifying State */}
        {status === "verifying" && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-900/20 border border-blue-800">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--foreground)]">
              {t('auth.verifying')}
            </h2>
            <p className="mt-2 text-center text-sm text-[var(--foreground-muted)]">
              {t('auth.verifying_message')}
            </p>
          </div>
        )}

        {/* Success State */}
        {status === "success" && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-900/20 border border-green-800">
              <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--foreground)]">
              {t('auth.email_verified_title')}
            </h2>
            <p className="mt-2 text-center text-sm text-[var(--foreground-muted)]">
              {t('auth.email_verified_message')}
            </p>
            <div className="mt-6">
              <Link
                href="/auth/signin"
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                {t('auth.go_to_signin')}
              </Link>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-900/20 border border-red-800">
              <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--foreground)]">
              {t('auth.verification_failed_title')}
            </h2>
            <p className="mt-2 text-center text-sm text-red-400">
              {error}
            </p>

            {/* Resend Verification Form */}
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-medium text-[var(--foreground)]">
                {t('auth.resend_verification_title')}
              </h3>
              <div>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-3 border border-[var(--border)] placeholder-[var(--foreground-muted)] text-[var(--foreground)] bg-[var(--surface)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  placeholder={t('auth.email_placeholder') as string}
                />
              </div>
              <button
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resending ? t('auth.resending') : t('auth.resend_verification_button')}
              </button>
              <Link
                href="/auth/signin"
                className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {t('auth.back_to_signin')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
