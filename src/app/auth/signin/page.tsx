"use client";

import { useState, useEffect } from "react";
import { signIn, getSession, getProviders, ClientSafeProvider } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [disableCredentialsLogin, setDisableCredentialsLogin] = useState(true);
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const { t } = useTranslation();
  const { branding } = useTheme();

  useEffect(() => {
    (async () => {
      const res = await getProviders();
      setProviders(res);

      const setupRes = await fetch("/api/setup/check");
      if (setupRes.ok) {
        const data = await setupRes.json();
        setDisableCredentialsLogin(data.disableCredentialsLogin ?? false);
      }
    })();
  }, []);

  useEffect(() => {
    if (errorParam === "OAuthNoEmail") {
      setError(
        t(
          "auth.error_oauth_no_email",
          "No email is associated with this provider account. Make sure your identity provider is configured to share the email claim."
        )
      );
    } else if (errorParam === "OAuthSignin") {
      setError(
        t(
          "auth.error_oauth_signin",
          "An error occurred while signing in with this provider. Please try again."
        )
      );
    } else if (errorParam === "EmailNotVerified") {
      setError(t("auth.error_email_not_verified"));
    } else if (errorParam && providers && providers[errorParam]) {
      // Auto-click if error param matches a provider ID (e.g. error=github)
      signIn(errorParam, { callbackUrl: "/" });
    }
  }, [errorParam, providers, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error === "EmailNotVerified") {
        setError(t("auth.error_email_not_verified"));
      } else if (result?.error) {
        setError(t("auth.error_invalid_credentials"));
      } else {
        // Verify session was created successfully
        const session = await getSession();
        if (session) {
          router.push("/");
        }
      }
    } catch (error) {
      setError(t("auth.error_generic") + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <Image src="/logo.svg" alt="" width={40} height={40} className="mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">
            {t("auth.signin_title", "Sign in")}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">{branding.appName}</p>
        </div>

        {/* Error message */}
        {error && <p className="mb-4 text-sm text-[var(--destructive)] text-center">{error}</p>}

        {/* Credentials form */}
        {!disableCredentialsLogin && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("auth.email_label", "Email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder={t("auth.email_placeholder") as string}
              required
            />
            <Input
              label={t("auth.password_label", "Password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={t("auth.password_placeholder") as string}
              required
            />
            <Button type="submit" isLoading={loading} className="w-full">
              {t("auth.signin_button", "Sign in")}
            </Button>
          </form>
        )}

        {/* OAuth providers */}
        {providers &&
          Object.values(providers).filter((p: ClientSafeProvider) => p.name !== "credentials")
            .length > 0 && (
            <>
              {!disableCredentialsLogin && (
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--border)]"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[var(--background)] text-[var(--foreground-muted)]">
                      {t("auth.or_continue_with", "Or continue with")}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {Object.values(providers)
                  .filter((p: ClientSafeProvider) => p.name !== "credentials")
                  .map((provider: ClientSafeProvider) => (
                    <Button
                      key={provider.name}
                      variant="secondary"
                      className="w-full"
                      onClick={() => signIn(provider.id, { callbackUrl: "/" })}
                    >
                      {t("auth.signin_with", "Sign in with")} {provider.name}
                    </Button>
                  ))}
              </div>
            </>
          )}

        {/* Sign up link */}
        {!disableCredentialsLogin && (
          <p className="text-center text-sm text-[var(--foreground-muted)] mt-6">
            {t("auth.no_account", "No account?")}{" "}
            <Link href="/auth/signup" className="text-[var(--primary)] hover:underline">
              {t("auth.signup_link", "Sign up")}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
