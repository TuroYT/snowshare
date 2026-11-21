"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/Spinner";

const PRIMARY_LINK_BUTTON =
  "inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-[var(--radius)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:ring-[var(--primary)]";

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
            <Spinner className="w-10 h-10 mx-auto" />
            <p role="status" className="text-sm text-[var(--foreground-muted)]">
              {t("auth.verify_email_verifying")}
            </p>
          </>
        )}

        {state === "check_email" && (
          <>
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--primary)_30%,transparent)]">
              <svg
                aria-hidden="true"
                className="h-8 w-8 text-[var(--primary)]"
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
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              {t("auth.verify_email_check_inbox_title")}
            </h2>
            <p className="text-sm text-[var(--foreground-muted)]">
              {t("auth.verify_email_check_inbox_message")}
            </p>
            <Link href="/auth/signin" className={PRIMARY_LINK_BUTTON}>
              {t("nav.signin")}
            </Link>
          </>
        )}

        {state === "success" && (
          <>
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-[color-mix(in_srgb,var(--success)_30%,transparent)]">
              <svg
                aria-hidden="true"
                className="h-8 w-8 text-[var(--success-text)]"
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
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              {t("auth.verify_email_success_title")}
            </h2>
            <p className="text-sm text-[var(--foreground-muted)]">
              {t("auth.verify_email_success_message")}
            </p>
            <Link href="/auth/signin" className={PRIMARY_LINK_BUTTON}>
              {t("nav.signin")}
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)]">
              <svg
                aria-hidden="true"
                className="h-8 w-8 text-[var(--destructive-text)]"
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
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              {t("auth.verify_email_error_title")}
            </h2>
            <p role="alert" className="text-sm text-[var(--foreground-muted)]">
              {errorMessage}
            </p>
            <Link href="/auth/signin" className={PRIMARY_LINK_BUTTON}>
              {t("nav.signin")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
