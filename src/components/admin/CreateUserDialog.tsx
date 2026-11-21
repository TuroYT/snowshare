"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Input, Modal } from "@/components/ui";

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

export default function CreateUserDialog({
  isOpen,
  onClose,
  onUserCreated,
}: Readonly<CreateUserDialogProps>) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [ssoAutoLink, setSsoAutoLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          password: ssoAutoLink ? undefined : password,
          isAdmin,
          ssoAutoLink,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create user");
      }

      setEmail("");
      setName("");
      setPassword("");
      setIsAdmin(false);
      setSsoAutoLink(false);
      onUserCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        // A pending request would otherwise reset or close a dialog reopened in the meantime
        if (!loading) onClose();
      }}
      title={t("admin.users.create_user")}
      size="sm"
    >
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={`${t("admin.users.email")} *`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("admin.users.email_placeholder")}
          required
          disabled={loading}
        />

        <Input
          label={t("admin.users.name")}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("admin.users.name_placeholder")}
          disabled={loading}
        />

        <div className="flex items-start gap-3 p-3 border border-[var(--border)] rounded-[var(--radius)]">
          <input
            type="checkbox"
            id="ssoAutoLink"
            checked={ssoAutoLink}
            onChange={(e) => setSsoAutoLink(e.target.checked)}
            className="w-4 h-4 mt-0.5 shrink-0 accent-[var(--primary)] cursor-pointer"
            disabled={loading}
          />
          <div className="min-w-0">
            <label
              htmlFor="ssoAutoLink"
              className="text-sm font-medium text-[var(--foreground)] cursor-pointer"
            >
              {t("admin.users.sso_auto_link")}
            </label>
            <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
              {t("admin.users.sso_auto_link_hint")}
            </p>
          </div>
        </div>

        {!ssoAutoLink && (
          <Input
            label={`${t("admin.users.password")} *`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("admin.users.password_placeholder")}
            helperText={t("admin.users.password_hint")}
            required
            disabled={loading}
          />
        )}

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isAdmin"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            className="w-4 h-4 shrink-0 accent-[var(--primary)] cursor-pointer"
            disabled={loading}
          />
          <label htmlFor="isAdmin" className="text-sm text-[var(--foreground)] cursor-pointer">
            {t("admin.users.make_admin")}
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? t("admin.users.creating") : t("admin.users.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
