"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Input, Modal } from "@/components/ui";

interface SetPasswordDialogProps {
  /** The user whose password is being set, or null when the dialog is closed */
  user: { id: string; email: string } | null;
  onClose: () => void;
  onPasswordSet: () => void;
}

export default function SetPasswordDialog({
  user,
  onClose,
  onPasswordSet,
}: Readonly<SetPasswordDialogProps>) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    // A pending request would otherwise reset or close a dialog reopened in the meantime
    if (loading) return;
    setPassword("");
    setMustChange(true);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          action: "setPassword",
          password,
          mustChangePassword: mustChange,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t("admin.users.set_password_error"));
      }

      setPassword("");
      setMustChange(true);
      onPasswordSet();
      onClose();
    } catch (err) {
      console.error("Failed to set the user password:", err);
      setError(err instanceof Error ? err.message : t("admin.users.set_password_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={user !== null}
      onClose={close}
      title={t("admin.users.set_password_title")}
      size="sm"
    >
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-[var(--foreground-muted)]">
          {t("admin.users.set_password_description", { email: user?.email ?? "" })}
        </p>

        <Input
          label={`${t("admin.users.password")} *`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("admin.users.password_placeholder")}
          helperText={t("admin.users.password_hint")}
          autoComplete="new-password"
          required
          disabled={loading}
        />

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="mustChangePassword"
            checked={mustChange}
            onChange={(e) => setMustChange(e.target.checked)}
            className="w-4 h-4 mt-0.5 shrink-0 accent-[var(--primary)] cursor-pointer"
            disabled={loading}
          />
          <div className="min-w-0">
            <label
              htmlFor="mustChangePassword"
              className="text-sm font-medium text-[var(--foreground)] cursor-pointer"
            >
              {t("admin.users.must_change_password")}
            </label>
            <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
              {t("admin.users.must_change_password_hint")}
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={close}
            disabled={loading}
            className="flex-1"
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" isLoading={loading} className="flex-1">
            {t("admin.users.set_password_submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
