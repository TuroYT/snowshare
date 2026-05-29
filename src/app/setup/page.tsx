"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { signIn, SignInResponse } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function Setup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // Check if setup is actually needed
    const checkSetupStatus = async () => {
      try {
        const response = await fetch("/api/setup/check");
        const data = await response.json();

        if (!data.needsSetup) {
          // Setup not needed, redirect to home
          router.push("/");
        } else {
          setChecking(false);
        }
      } catch {
        setChecking(false);
      }
    };

    checkSetupStatus();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth.error_passwords_mismatch"));
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t("auth.error_password_too_short"));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, isFirstUser: true }),
      });

      const data = await response.json();

      if (response.ok) {
        const signInResult = (await signIn("credentials", {
          redirect: false,
          email,
          password,
        })) as SignInResponse | undefined;

        if (signInResult?.ok) {
          // Redirect to home after successful sign-in
          router.push("/");
        } else {
          // If auto-login failed, redirect to sign-in with a message
          router.push(
            `/auth/signin?message=${encodeURIComponent(t("auth.success_account_created"))}`
          );
        }
      } else {
        setError(data.error || t("auth.error_generic").replace(" : ", ""));
      }
    } catch {
      setError(t("auth.error_generic").replace(" : ", ""));
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          <p className="mt-4 text-sm text-[var(--foreground-muted)]" suppressHydrationWarning>
            {t("loading")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <Image src="/logo.svg" alt="" width={40} height={40} className="mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">
            {t("setup.title")}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">{t("setup.description")}</p>
        </div>

        {/* Info notice */}
        <div className="mb-6 p-3 rounded-[var(--radius)] bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground-muted)]">
          {t("setup.info")}
        </div>

        {/* Error message */}
        {error && <p className="mb-4 text-sm text-[var(--destructive)] text-center">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t("auth.email_label", "Email")}
            type="email"
            autoComplete="email"
            required
            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
            placeholder={t("auth.email_placeholder") as string}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t("auth.password_label", "Password")}
            type="password"
            autoComplete="new-password"
            required
            placeholder={t("auth.password_new_placeholder") as string}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label={t("auth.confirm_password_label", "Confirm password")}
            type="password"
            autoComplete="new-password"
            required
            placeholder={t("auth.confirm_password_placeholder") as string}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button type="submit" isLoading={loading} className="w-full">
            {t("setup.submit")}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--foreground-muted)]">
          {t("setup.admin_notice")}
        </p>
      </div>
    </div>
  );
}
