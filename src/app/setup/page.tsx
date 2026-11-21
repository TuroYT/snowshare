"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { signIn, SignInResponse } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import FormNotice from "@/app/auth/_components/FormNotice";

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
    const checkSetupStatus = async () => {
      try {
        const response = await fetch("/api/setup/check");
        const data = await response.json();

        if (!data.needsSetup) {
          router.replace("/");
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
    if (loading) return;
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth.error_passwords_mismatch"));
      return;
    }

    if (password.length < 6) {
      setError(t("auth.error_password_too_short"));
      return;
    }

    setLoading(true);
    let redirecting = false;
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

        // Stay in the busy state until the navigation replaces the page
        redirecting = true;
        router.replace(signInResult?.ok ? "/" : "/auth/signin?notice=account_created");
      } else {
        setError(data.error || t("auth.error_generic_standalone"));
      }
    } catch {
      setError(t("auth.error_generic_standalone"));
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto" />
          <p
            role="status"
            className="mt-4 text-sm text-[var(--foreground-muted)]"
            suppressHydrationWarning
          >
            {t("loading")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/logo.svg"
            unoptimized
            alt=""
            width={40}
            height={40}
            className="mx-auto mb-3"
          />
          <h1 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">
            {t("setup.title")}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">{t("setup.description")}</p>
        </div>

        <div className="mb-6 p-3 rounded-[var(--radius)] bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground-muted)]">
          {t("setup.info")}
        </div>

        <FormNotice message={error || null} variant="danger" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t("auth.email_label", "Email")}
            type="email"
            autoComplete="email"
            required
            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
            placeholder={t("auth.email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t("auth.password_label", "Password")}
            type="password"
            autoComplete="new-password"
            required
            placeholder={t("auth.password_new_placeholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label={t("auth.confirm_password_label", "Confirm password")}
            type="password"
            autoComplete="new-password"
            required
            placeholder={t("auth.confirm_password_placeholder")}
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
