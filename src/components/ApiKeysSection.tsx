"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetch } from "@/hooks/useFetch";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function ApiKeysSection() {
  const { t } = useTranslation();
  const { data: keysData, loading, refetch: refetchKeys } = useFetch<{ data: ApiKey[] }>("/api/keys");
  const keys = keysData?.data ?? [];
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const body: Record<string, string> = { name: newKeyName.trim() };
      if (newKeyExpiry) body.expiresAt = new Date(newKeyExpiry).toISOString();

      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("apikeys.error_create"));
        return;
      }

      setRevealedToken(data.token);
      setNewKeyName("");
      setNewKeyExpiry("");
      refetchKeys();
    } catch {
      setError(t("apikeys.error_create"));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(t("apikeys.confirm_revoke"))) return;
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        refetchKeys();
      }
    } catch {
      // ignore
    }
  };

  const handleCopy = async () => {
    if (!revealedToken) return;
    try {
      await navigator.clipboard.writeText(revealedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          {t("apikeys.title", "API Keys")}
        </h2>
        <p className="text-sm text-[var(--muted)] mb-6">
          {t(
            "apikeys.description",
            "Use API keys to authenticate scripting and CLI access. Keys inherit all your account permissions."
          )}
        </p>

        {/* Create form */}
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end mb-6">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              {t("apikeys.label_name", "Key name")}
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t("apikeys.placeholder_name", "e.g. My backup script")}
              className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--primary)]"
              maxLength={64}
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              {t("apikeys.label_expiry", "Expiration (optional)")}
            </label>
            <input
              type="date"
              value={newKeyExpiry}
              onChange={(e) => setNewKeyExpiry(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !newKeyName.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {creating
              ? t("apikeys.creating", "Creating...")
              : t("apikeys.create_button", "Create key")}
          </button>
        </form>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {/* Revealed token modal */}
        {revealedToken && (
          <div className="mb-6 p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
            <p className="text-sm font-semibold text-yellow-400 mb-2">
              {t("apikeys.token_warning", "Save this key — it will not be shown again.")}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono break-all bg-[var(--background)] px-3 py-2 rounded border border-[var(--border)] text-[var(--foreground)]">
                {revealedToken}
              </code>
              <button
                onClick={handleCopy}
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {copied ? t("apikeys.copied", "Copied!") : t("apikeys.copy", "Copy")}
              </button>
            </div>
            <button
              onClick={() => setRevealedToken(null)}
              className="mt-3 text-xs text-[var(--muted)] hover:text-[var(--foreground)] underline"
            >
              {t("apikeys.dismiss", "Dismiss")}
            </button>
          </div>
        )}

        {/* Keys list */}
        {loading ? (
          <p className="text-sm text-[var(--muted)]">{t("loading", "Loading...")}</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("apikeys.no_keys", "No API keys yet.")}</p>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">
                    {key.name}
                  </p>
                  <p className="text-xs text-[var(--muted)] font-mono mt-0.5">{key.keyPrefix}...</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {t("apikeys.created", "Created")} {formatDate(key.createdAt)}
                    {key.lastUsedAt &&
                      ` · ${t("apikeys.last_used", "Last used")} ${formatDate(key.lastUsedAt)}`}
                    {key.expiresAt &&
                      ` · ${t("apikeys.expires", "Expires")} ${formatDate(key.expiresAt)}`}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="shrink-0 px-3 py-1.5 text-xs rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {t("apikeys.revoke", "Revoke")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Docs link */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            {t("apikeys.docs_title", "API Documentation")}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {t(
              "apikeys.docs_description",
              "Browse the interactive API docs to explore all endpoints."
            )}
          </p>
        </div>
        <a
          href="/api-docs"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          {t("apikeys.docs_link", "Open docs")}
        </a>
      </div>
    </div>
  );
}
