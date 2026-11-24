"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { reopenSession } from "@/lib/client/reopen-session";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import FormNotice from "@/app/auth/_components/FormNotice";
import AuthShell from "@/app/auth/_components/AuthShell";
import { PASSWORD_MIN_LENGTH } from "@/lib/share-constants";

/** Where users land after an admin asked them to pick their own password. */
export default function ChangePassword() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (newPassword !== confirmPassword) {
      setError(t("auth.error_passwords_mismatch"));
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(t("auth.error_password_too_short"));
      return;
    }
    if (newPassword === currentPassword) {
      setError(t("auth.error_password_unchanged"));
      return;
    }
    setLoading(true);
    setError("");

    let redirecting = false;
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("auth.error_generic_standalone"));
        return;
      }
      // The change signed this session out with all the others: sign in again with the new
      // password (which also drops the "new password required" gate). If that fails the
      // password is saved but the user has to sign in by hand.
      if (!session?.user?.email || !(await reopenSession(session.user.email, newPassword))) {
        setError(t("auth.error_session_refresh"));
        return;
      }
      redirecting = true;
      // A full navigation: the client router may have cached "/" as a redirect to this page
      globalThis.location.assign("/");
    } catch (err) {
      console.error("Password change failed:", err);
      setError(t("auth.error_generic_standalone"));
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  if (status === "unauthenticated") return null;

  return (
    <AuthShell title={t("auth.change_title", "Choose a new password")}>
      <p className="text-sm text-[var(--foreground-muted)] mb-6 text-center">
        {t(
          "auth.change_description",
          "An administrator asked you to set your own password before continuing."
        )}
      </p>
      <FormNotice message={error || null} variant="danger" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t("auth.current_password_label", "Current password")}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Input
          label={t("auth.new_password_label", "New password")}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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
      <p className="text-center text-sm mt-6">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="text-[var(--foreground-muted)] hover:underline"
        >
          {t("nav.signout", "Sign out")}
        </button>
      </p>
    </AuthShell>
  );
}
