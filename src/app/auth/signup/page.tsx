"use client";

import { useState, useEffect, useRef } from "react";
import { signIn, type SignInResponse } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

declare global {
  interface Window {
    grecaptcha: {
      render: (container: HTMLElement, options: Record<string, unknown>) => number;
      reset: (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
    };
    turnstile: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
    onRecaptchaLoad?: () => void;
    onTurnstileLoad?: () => void;
  }
}

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [allowSignup, setAllowSignup] = useState(true);
  const [disableCredentialsLogin, setDisableCredentialsLogin] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaProvider, setCaptchaProvider] = useState<string | null>(null);
  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaWidgetId = useRef<string | number | null>(null);
  const router = useRouter();
  const { t } = useTranslation();
  const { branding } = useTheme();

  // Check signup status from database
  useEffect(() => {
    const fetchSignupStatus = async () => {
      try {
        const response = await fetch("/api/setup/check");
        if (response.ok) {
          const data = await response.json();
          setAllowSignup(data.allowSignup ?? true);
          setDisableCredentialsLogin(data.disableCredentialsLogin ?? false);
          setCaptchaEnabled(data.captchaEnabled ?? false);
          setCaptchaProvider(data.captchaProvider ?? null);
          setCaptchaSiteKey(data.captchaSiteKey ?? null);
        }
      } catch (error) {
        console.error("Error fetching signup status:", error);
        setAllowSignup(true);
      } finally {
        setCheckingStatus(false);
      }
    };

    fetchSignupStatus();
  }, []);

  // Load and render the CAPTCHA widget once settings are available
  useEffect(() => {
    if (!captchaEnabled || !captchaSiteKey || !captchaProvider || !captchaRef.current) return;

    const container = captchaRef.current;

    if (captchaProvider === "recaptcha") {
      const scriptId = "recaptcha-script";
      if (!document.getElementById(scriptId)) {
        window.onRecaptchaLoad = () => {
          if (container && window.grecaptcha) {
            captchaWidgetId.current = window.grecaptcha.render(container, {
              sitekey: captchaSiteKey,
              callback: (token: string) => setCaptchaToken(token),
              "expired-callback": () => setCaptchaToken(""),
            });
          }
        };
        const script = document.createElement("script");
        script.id = scriptId;
        script.src =
          "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      } else if (window.grecaptcha) {
        captchaWidgetId.current = window.grecaptcha.render(container, {
          sitekey: captchaSiteKey,
          callback: (token: string) => setCaptchaToken(token),
          "expired-callback": () => setCaptchaToken(""),
        });
      }
    } else if (captchaProvider === "turnstile") {
      const scriptId = "turnstile-script";
      if (!document.getElementById(scriptId)) {
        window.onTurnstileLoad = () => {
          if (container && window.turnstile) {
            captchaWidgetId.current = window.turnstile.render(container, {
              sitekey: captchaSiteKey,
              callback: (token: string) => setCaptchaToken(token),
              "expired-callback": () => setCaptchaToken(""),
            });
          }
        };
        const script = document.createElement("script");
        script.id = scriptId;
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      } else if (window.turnstile) {
        captchaWidgetId.current = window.turnstile.render(container, {
          sitekey: captchaSiteKey,
          callback: (token: string) => setCaptchaToken(token),
          "expired-callback": () => setCaptchaToken(""),
        });
      }
    }
  }, [captchaEnabled, captchaSiteKey, captchaProvider, checkingStatus]);

  // Show loading state while checking signup status
  if (checkingStatus) {
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

  if (disableCredentialsLogin) {
    redirect("/auth/signin");
  }

  // Show disabled message if signup is not allowed
  if (!allowSignup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] tracking-tight mb-3">
            {t("auth.signup_disabled_title", "Sign up disabled")}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mb-6">
            {t("auth.signup_disabled_message", "New registrations are currently not allowed.")}
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center w-full text-sm font-medium px-4 py-2 rounded-[var(--radius)] bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors duration-100"
          >
            {t("nav.signin")}
          </Link>
        </div>
      </div>
    );
  }

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

    if (captchaEnabled && !captchaToken) {
      setError(t("auth.error_captcha_required"));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, captchaToken: captchaToken || undefined }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresVerification) {
          // Redirect to the "check your email" page
          router.push("/auth/verify-email");
          return;
        }

        // Auto-login after successful registration using NextAuth credentials provider
        const signInResult = (await signIn("credentials", {
          redirect: false,
          email,
          password,
        })) as SignInResponse | undefined;

        if (signInResult?.ok) {
          router.push("/");
        } else {
          router.push(
            `/auth/signin?message=${encodeURIComponent(t("auth.success_account_created"))}`
          );
        }
      } else {
        setError(data.error || t("auth.error_generic").replace(" : ", ""));
        // Reset CAPTCHA on error
        if (captchaEnabled) {
          if (captchaProvider === "recaptcha" && window.grecaptcha) {
            window.grecaptcha.reset(captchaWidgetId.current as number);
          } else if (captchaProvider === "turnstile" && window.turnstile) {
            window.turnstile.reset(captchaWidgetId.current as string);
          }
          setCaptchaToken("");
        }
      }
    } catch {
      setError(t("auth.error_generic").replace(" : ", ""));
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
            {t("auth.signup_title", "Create an account")}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">{branding.appName}</p>
        </div>

        {/* Error message */}
        {error && <p className="mb-4 text-sm text-[var(--destructive)] text-center">{error}</p>}

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
            autoComplete="new-password"
            placeholder={t("auth.password_new_placeholder") as string}
            required
          />
          <Input
            label={t("auth.confirm_password_label", "Confirm password")}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={t("auth.confirm_password_placeholder") as string}
            required
          />

          {/* CAPTCHA widget */}
          {captchaEnabled && captchaSiteKey && (
            <div className="flex justify-center">
              <div ref={captchaRef}></div>
            </div>
          )}

          <Button type="submit" isLoading={loading} className="w-full">
            {t("auth.signup_button", "Create account")}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--foreground-muted)] mt-6">
          {t("auth.have_account", "Already have an account?")}{" "}
          <Link href="/auth/signin" className="text-[var(--primary)] hover:underline">
            {t("auth.signin_link", "Sign in")}
          </Link>
        </p>

        <div className="mt-4 text-center text-xs text-[var(--foreground-muted)]">
          <p>
            {t("auth.terms_notice")}{" "}
            <Link href="/terms-of-use" className="text-[var(--primary)] hover:underline">
              {t("footer.terms_of_use", "Terms of Use")}
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
