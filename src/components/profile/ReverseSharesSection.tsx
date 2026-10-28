"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetch } from "@/hooks/useFetch";
import WarningModal from "@/components/admin/WarningModal";

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

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--primary)]";

export default function ReverseSharesSection() {
  const { t } = useTranslation();
  const { data, loading, refetch } = useFetch<{ data: ReverseShare[] }>("/api/user/reverse-shares");
  const items = data?.data ?? [];
  const [form, setForm] = useState({
    name: "",
    password: "",
    expiresAt: "",
    maxUploads: "",
    maxSizeMB: "",
  });
  const [creating, setCreating] = useState(false);
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
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
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
    try {
      const res = await fetch(`/api/user/reverse-shares/${id}`, { method: "DELETE" });
      if (res.ok) refetch();
      else setError(t("reverse_shares.error_delete", "Could not delete the request."));
    } catch (err) {
      console.error("Failed to delete upload request:", err);
      setError(t("reverse_shares.error_delete", "Could not delete the request."));
    } finally {
      setToDelete(null);
    }
  };

  const handleCopy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(slug));
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy upload request link:", err);
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
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
      <p className="text-sm text-[var(--muted)] mb-6">
        {t(
          "reverse_shares.description",
          "Create a link through which anyone, even without an account, can send you files. Each submission appears in your shares."
        )}
      </p>

      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">
            {t("reverse_shares.label_name", "Name shown to senders")}
          </label>
          <input
            className={inputClass}
            value={form.name}
            onChange={set("name")}
            maxLength={100}
            placeholder={t("reverse_shares.placeholder_name", "e.g. Wedding photos")}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">
            {t("reverse_shares.label_expiry", "Expiration (optional)")}
          </label>
          <input
            type="date"
            className={inputClass}
            value={form.expiresAt}
            onChange={set("expiresAt")}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">
            {t("reverse_shares.label_password", "Password (optional)")}
          </label>
          <input
            type="password"
            className={inputClass}
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">
            {t("reverse_shares.label_max_uploads", "Max submissions (optional)")}
          </label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={form.maxUploads}
            onChange={set("maxUploads")}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">
            {t("reverse_shares.label_max_size", "Max size per submission, MB (optional)")}
          </label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={form.maxSizeMB}
            onChange={set("maxSizeMB")}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={creating || !form.name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {creating
              ? t("reverse_shares.creating", "Creating...")
              : t("reverse_shares.create_button", "Create link")}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {loading && <p className="text-sm text-[var(--muted)]">{t("loading", "Loading...")}</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          {t("reverse_shares.empty", "No upload requests yet.")}
        </p>
      )}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((rs) => (
            <div
              key={rs.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{rs.name}</p>
                <p className="text-xs text-[var(--muted)] font-mono truncate">/r/{rs.slug}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {t("reverse_shares.submissions", "Submissions: {{count}}", {
                    count: rs.uploadCount,
                  })}
                  {rs.maxUploads !== null && ` / ${rs.maxUploads}`}
                  {rs.expiresAt &&
                    ` · ${t("reverse_shares.expires", "Expires")} ${new Date(rs.expiresAt).toLocaleDateString()}`}
                  {rs.hasPassword && ` · ${t("reverse_shares.protected", "Password protected")}`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleCopy(rs.slug)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  {copied === rs.slug
                    ? t("reverse_shares.copied", "Copied!")
                    : t("reverse_shares.copy_link", "Copy link")}
                </button>
                <button
                  onClick={() => setToDelete(rs.id)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {t("reverse_shares.delete", "Delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
