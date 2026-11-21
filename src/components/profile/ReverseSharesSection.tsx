"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetch } from "@/hooks/useFetch";
import WarningModal from "@/components/admin/WarningModal";
import { Alert, Button, Card, Input, toast } from "@/components/ui";
import { copyText } from "@/lib/clipboard";

interface ReverseShare {
  id: string;
  slug: string;
  name: string;
  hasPassword: boolean;
  expiresAt: string | null;
  maxUploads: number | null;
  maxSizeMB: number | null;
  uploadCount: number;
  createdAt: string;
}

/** "YYYY-MM-DD" from a date input -> end of that day in the user's timezone, as ISO. */
function endOfLocalDay(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59).toISOString();
}

export default function ReverseSharesSection() {
  const { t } = useTranslation();
  const {
    data,
    loading,
    error: loadError,
    refetch,
  } = useFetch<{ data: ReverseShare[] }>("/api/user/reverse-shares");
  const items = data?.data ?? [];
  const [form, setForm] = useState({
    name: "",
    password: "",
    expiresAt: "",
    maxUploads: "",
    maxSizeMB: "",
  });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const linkFor = (slug: string) => `${window.location.origin}/r/${slug}`;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/user/reverse-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          password: form.password || undefined,
          expiresAt: form.expiresAt ? endOfLocalDay(form.expiresAt) : undefined,
          maxUploads: form.maxUploads || undefined,
          maxSizeMB: form.maxSizeMB || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || t("reverse_shares.error_create", "Could not create the request."));
        return;
      }
      setForm({ name: "", password: "", expiresAt: "", maxUploads: "", maxSizeMB: "" });
      refetch();
    } catch (err) {
      console.error("Failed to create upload request:", err);
      setError(t("reverse_shares.error_create", "Could not create the request."));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/reverse-shares/${id}`, { method: "DELETE" });
      if (res.ok) refetch();
      else setError(t("reverse_shares.error_delete", "Could not delete the request."));
    } catch (err) {
      console.error("Failed to delete upload request:", err);
      setError(t("reverse_shares.error_delete", "Could not delete the request."));
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const handleCopy = async (slug: string) => {
    if (!(await copyText(linkFor(slug)))) {
      toast.error(t("common.copy_failed"));
      return;
    }
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Card>
      <WarningModal
        open={toDelete !== null}
        title={t("reverse_shares.delete", "Delete")}
        message={t(
          "reverse_shares.confirm_delete",
          "Delete this upload request? Files already received stay in your shares."
        )}
        onConfirm={() => toDelete && handleDelete(toDelete)}
        onCancel={() => setToDelete(null)}
      />
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-1">
        {t("reverse_shares.title", "Upload requests")}
      </h2>
      <p className="text-sm text-[var(--foreground-muted)] mb-6">
        {t(
          "reverse_shares.description",
          "Create a link through which anyone, even without an account, can send you files. Each submission appears in your shares."
        )}
      </p>

      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="sm:col-span-2">
          <Input
            label={t("reverse_shares.label_name", "Name shown to senders")}
            value={form.name}
            onChange={set("name")}
            maxLength={100}
            placeholder={t("reverse_shares.placeholder_name", "e.g. Wedding photos")}
          />
        </div>
        <Input
          type="date"
          label={t("reverse_shares.label_expiry", "Expiration (optional)")}
          value={form.expiresAt}
          onChange={set("expiresAt")}
        />
        <Input
          type="password"
          label={t("reverse_shares.label_password", "Password (optional)")}
          value={form.password}
          onChange={set("password")}
          autoComplete="new-password"
        />
        <Input
          type="number"
          min={1}
          label={t("reverse_shares.label_max_uploads", "Max submissions (optional)")}
          value={form.maxUploads}
          onChange={set("maxUploads")}
        />
        <Input
          type="number"
          min={1}
          label={t("reverse_shares.label_max_size", "Max size per submission, MB (optional)")}
          value={form.maxSizeMB}
          onChange={set("maxSizeMB")}
        />
        <div className="sm:col-span-2 flex justify-end">
          <Button
            type="submit"
            disabled={creating || deleting || loading || !form.name.trim()}
            isLoading={creating}
          >
            {creating
              ? t("reverse_shares.creating", "Creating...")
              : t("reverse_shares.create_button", "Create link")}
          </Button>
        </div>
      </form>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {loading && (
        <p className="text-sm text-[var(--foreground-muted)]">{t("loading", "Loading...")}</p>
      )}
      {!loading && loadError && (
        <Alert variant="danger" className="flex flex-wrap items-center gap-3">
          <p className="min-w-0">
            {t("reverse_shares.error_load", "Could not load your upload requests.")}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={refetch}
            disabled={creating || deleting}
          >
            {t("reverse_shares.retry", "Retry")}
          </Button>
        </Alert>
      )}
      {!loading && !loadError && items.length === 0 && (
        <p className="text-sm text-[var(--foreground-muted)]">
          {t("reverse_shares.empty", "No upload requests yet.")}
        </p>
      )}
      {!loading && !loadError && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((rs) => (
            <li
              key={rs.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{rs.name}</p>
                <p className="text-xs text-[var(--foreground-muted)] font-mono truncate">
                  /r/{rs.slug}
                </p>
                <p className="text-xs text-[var(--foreground-muted)] mt-0.5 break-words">
                  {t("reverse_shares.submissions", "Submissions: {{count}}", {
                    count: rs.uploadCount,
                  })}
                  {rs.maxUploads !== null && ` / ${rs.maxUploads}`}
                  {rs.expiresAt &&
                    ` · ${t("reverse_shares.expires", "Expires")} ${new Date(rs.expiresAt).toLocaleDateString()}`}
                  {rs.hasPassword && ` · ${t("reverse_shares.protected", "Password protected")}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleCopy(rs.slug)}>
                  {copied === rs.slug
                    ? t("reverse_shares.copied", "Copied!")
                    : t("reverse_shares.copy_link", "Copy link")}
                </Button>
                <Button
                  variant="danger-outline"
                  size="sm"
                  onClick={() => setToDelete(rs.id)}
                  disabled={creating || deleting}
                >
                  {t("reverse_shares.delete", "Delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
