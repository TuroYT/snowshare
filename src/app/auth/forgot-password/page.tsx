"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import FormNotice from "@/app/auth/_components/FormNotice";
import AuthShell from "@/app/auth/_components/AuthShell";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const router = useRouter();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/setup/check");
        const data = res.ok ? await res.json() : null;
        setAvailable(data?.passwordResetAvailable === true);
      } catch (err) {
        console.error("Error checking password reset availability:", err);
        setAvailable(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (available === false) router.replace("/auth/signin");
  }, [available, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("auth.error_generic_standalone"));
      }
    } catch (err) {
      console.error("Forgot password request failed:", err);
      setError(t("auth.error_generic_standalone"));
    } finally {
      setLoading(false);
    }
  };

  if (!available) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <AuthShell title={t("auth.forgot_title", "Forgot your password?")}>
      {sent ? (
        <div className="space-y-6 text-center">
          <FormNotice message={t("auth.forgot_sent")} variant="success" />
          <Link href="/auth/signin" className="text-sm text-[var(--primary)] hover:underline">
            {t("auth.back_to_signin", "Back to sign in")}
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--foreground-muted)] mb-6 text-center">
            {t(
              "auth.forgot_description",
              "Enter your email address and we will send you a link to choose a new password."
            )}
          </p>
          <FormNotice message={error || null} variant="danger" />
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("auth.email_label", "Email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder={t("auth.email_placeholder")}
              required
            />
            <Button type="submit" isLoading={loading} className="w-full">
              {t("auth.forgot_button", "Send reset link")}
            </Button>
          </form>
          <p className="text-center text-sm mt-6">
            <Link href="/auth/signin" className="text-[var(--primary)] hover:underline">
              {t("auth.back_to_signin", "Back to sign in")}
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
