"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";

type VerificationState = "pending" | "loading" | "success" | "error" | "check_email";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [state, setState] = useState<VerificationState>("pending");
  const [errorMessage, setErrorMessage] = useState("");

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const verify = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(
        `/api/auth/verify-email?token=${encodeURIComponent(token!)}&email=${encodeURIComponent(email!)}`,
        { method: "GET" }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setState("success");
      } else {
        setErrorMessage(data.error || t("auth.verify_email_error_generic"));
        setState("error");
      }
    } catch {
      setErrorMessage(t("auth.verify_email_error_generic"));
      setState("error");
    }
  }, [token, email, t]);

  useEffect(() => {
    if (token && email) {
      verify();
    } else {
      // No token/email params — user just registered and needs to check their email
      setState("check_email");
    }
  }, [token, email, verify]);

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        {state === "loading" && (
          <>
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-[var(--foreground-muted)]">{t("auth.verify_email_verifying")}</p>
          </>
        )}

        {state === "check_email" && (
          <>
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-900/20 border border-blue-800">
              <svg
                className="h-8 w-8 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-[var(--foreground)]">
              {t("auth.verify_email_check_inbox_title")}
            </h2>
            <p className="text-[var(--foreground-muted)]">
              {t("auth.verify_email_check_inbox_message")}
            </p>
            <Link
              href="/auth/signin"
              className="inline-flex items-center text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
            >
              {t("nav.signin")}
            </Link>
          </>
        )}

        {state === "success" && (
          <>
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-[var(--foreground)]">
              {t("auth.verify_email_success_title")}
            </h2>
            <p className="text-[var(--foreground-muted)]">
              {t("auth.verify_email_success_message")}
            </p>
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors"
            >
              {t("nav.signin")}
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-900/20 border border-red-800">
              <svg
                className="h-8 w-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-[var(--foreground)]">
              {t("auth.verify_email_error_title")}
            </h2>
            <p className="text-[var(--foreground-muted)]">{errorMessage}</p>
            <Link
              href="/auth/signin"
              className="inline-flex items-center text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
            >
              {t("nav.signin")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
