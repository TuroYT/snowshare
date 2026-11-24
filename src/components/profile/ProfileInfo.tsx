"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "@/components/ui/Toast";
import { reopenSession } from "@/lib/client/reopen-session";
import { Alert, Button, Card, Input, Select } from "@/components/ui";

type User = {
  id: string;
  name?: string;
  email: string;
  createdAt: string;
  defaultTab?: string;
  notifyOnAccess?: boolean;
};

type ProfileInfoProps = {
  user: User;
  onUpdate: (data: User) => void;
};

export default function ProfileInfo({ user, onUpdate }: Readonly<ProfileInfoProps>) {
  const { t } = useTranslation();
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email);
  const [defaultTab, setDefaultTab] = useState(user.defaultTab || "linkshare");
  const [notifyOnAccess, setNotifyOnAccess] = useState(user.notifyOnAccess ?? false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword && newPassword !== confirmPassword) {
      setError(t("profile.error_passwords_mismatch"));
      return;
    }

    if (newPassword && !currentPassword) {
      setError(t("profile.error_current_password_required"));
      return;
    }

    setSaving(true);

    try {
      const updateData: {
        name?: string;
        email?: string;
        currentPassword?: string;
        newPassword?: string;
        defaultTab?: string;
        notifyOnAccess?: boolean;
      } = { name, email, defaultTab, notifyOnAccess };

      // Changing the email or the password requires the current password (credentials accounts)
      if (currentPassword) {
        updateData.currentPassword = currentPassword;
      }
      if (newPassword) {
        updateData.newPassword = newPassword;
      }

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (res.ok) {
        if (newPassword && !(await reopenSession(data.user.email, newPassword))) {
          await signOut({ callbackUrl: "/auth/signin?notice=password_changed" });
          return;
        }
        setMessage(
          data.requiresVerification
            ? t(
                "profile.success_update_verify_email",
                "Profile updated. Please check your new email address to verify it."
              )
            : t("profile.success_update")
        );
        onUpdate(data.user);
        localStorage.setItem("defaultTab", defaultTab);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(data.error || t("profile.error_update"));
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError(t("profile.error_update"));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/user/export");
      if (!res.ok) throw new Error("Failed to export user data");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "snowshare-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export profile data:", err);
      toast.error(t("profile.export_error"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 shrink-0 rounded-[var(--radius)] border border-[var(--primary)]/30 bg-[var(--primary)]/10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-[var(--primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {t("profile.info_title")}
          </h2>
          <p className="text-sm text-[var(--foreground-muted)]">{t("profile.info_subtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <Input
            type="text"
            label={t("profile.label_name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("profile.placeholder_name")}
          />

          <Input
            type="email"
            label={`${t("profile.label_email")} *`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Select
            label={t("profile.default_tab")}
            helperText={t("profile.default_tab_desc")}
            value={defaultTab}
            onChange={(e) => setDefaultTab(e.target.value)}
          >
            <option value="linkshare">{t("profile.default_tab_linkshare")}</option>
            <option value="pasteshare">{t("profile.default_tab_pasteshare")}</option>
            <option value="fileshare">{t("profile.default_tab_fileshare")}</option>
          </Select>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyOnAccess}
              onChange={(e) => setNotifyOnAccess(e.target.checked)}
              className="mt-1 shrink-0 accent-[var(--primary)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--foreground)]">
                {t("profile.notify_on_access", "E-mail me when one of my shares is opened")}
              </span>
              <span className="block text-xs text-[var(--foreground-muted)]">
                {t(
                  "profile.notify_on_access_desc",
                  "At most one e-mail per share per hour. Requires e-mail to be configured by the administrator."
                )}
              </span>
            </span>
          </label>
        </div>

        <div className="border-t border-[var(--border)] pt-6">
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-[var(--secondary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {t("profile.change_password")}
          </h3>

          <div className="space-y-4">
            <Input
              type="password"
              label={t("profile.label_current_password")}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t("profile.placeholder_password")}
              autoComplete="current-password"
            />
            <Input
              type="password"
              label={t("profile.label_new_password")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("profile.placeholder_password")}
              autoComplete="new-password"
            />
            <Input
              type="password"
              label={t("profile.label_confirm_password")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("profile.placeholder_password")}
              autoComplete="new-password"
            />
          </div>
        </div>

        {message && (
          <Alert variant="success" className="p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="min-w-0 break-words">{message}</p>
            </div>
          </Alert>
        )}

        {error && (
          <Alert variant="danger" className="p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="min-w-0 break-words">{error}</p>
            </div>
          </Alert>
        )}

        <Button type="submit" className="w-full" isLoading={saving}>
          {saving ? t("profile.saving") : t("profile.save_changes")}
        </Button>
      </form>

      <div className="border-t border-[var(--border)] mt-6 pt-6">
        <h3 className="text-lg font-medium text-[var(--foreground)] mb-1 flex items-center gap-2">
          <Download className="w-5 h-5 text-[var(--secondary)]" aria-hidden="true" />
          {t("profile.export_title")}
        </h3>
        <p className="text-sm text-[var(--foreground-muted)] mb-4">{t("profile.export_desc")}</p>
        <Button type="button" variant="secondary" isLoading={exporting} onClick={handleExport}>
          {exporting ? (
            t("profile.export_downloading")
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" aria-hidden="true" />
              {t("profile.export_button")}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
