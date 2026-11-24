"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import FormNotice from "@/app/auth/_components/FormNotice";
import AuthShell from "@/app/auth/_components/AuthShell";
import { PASSWORD_MIN_LENGTH } from "@/lib/share-constants";

type TokenState = "checking" | "valid" | "invalid";

export default function ResetPassword() {
  const { t } = useTranslation();
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [tokenState, setTokenState] = useState<TokenState>(token ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Only looks at the link: opening it must not use it up (mail scanners do open links)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        if (!cancelled) setTokenState(res.ok ? "valid" : "invalid");
      } catch (err) {
        console.error("Error checking the reset link:", err);
        if (!cancelled) setTokenState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password !== confirmPassword) {
      setError(t("auth.error_passwords_mismatch"));
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(t("auth.error_password_too_short"));
      return;
    }
    setLoading(true);
    setError("");

    let redirecting = false;
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        redirecting = true;
        router.replace("/auth/signin?notice=password_reset");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.code === "TOKEN_INVALID_OR_EXPIRED") {
        setTokenState("invalid");
      } else {
        setError(data.error || t("auth.error_generic_standalone"));
      }
    } catch (err) {
      console.error("Password reset failed:", err);
      setError(t("auth.error_generic_standalone"));
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  if (tokenState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (tokenState === "invalid") {
    return (
      <AuthShell title={t("auth.reset_invalid_title", "This link no longer works")}>
        <div className="space-y-6 text-center">
          <p role="alert" className="text-sm text-[var(--foreground-muted)]">
            {t(
              "auth.reset_invalid_message",
              "The reset link is invalid, has expired or was already used. Request a new one."
            )}
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-flex items-center justify-center w-full px-4 py-2 rounded-[var(--radius)] text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors duration-100"
          >
            {t("auth.forgot_button", "Send reset link")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.reset_title", "Choose a new password")}>
      <FormNotice message={error || null} variant="danger" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t("auth.new_password_label", "New password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder={t("auth.password_new_placeholder")}
          required
        />
        <Input
          label={t("auth.confirm_password_label", "Confirm password")}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder={t("auth.confirm_password_placeholder")}
          required
        />
        <Button type="submit" isLoading={loading} className="w-full">
          {t("auth.reset_button", "Set new password")}
        </Button>
      </form>
    </AuthShell>
  );
}
