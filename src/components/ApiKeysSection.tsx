"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetch } from "@/hooks/useFetch";
import WarningModal from "@/components/admin/WarningModal";
import { downloadShareXConfig } from "@/lib/sharex";
import { Alert, Button, Card, Input, toast } from "@/components/ui";
import { copyText } from "@/lib/clipboard";

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
  const {
    data: keysData,
    loading,
    refetch: refetchKeys,
  } = useFetch<{ data: ApiKey[] }>("/api/keys");
  // Revoked keys disappear right away; they come back if the request fails
  const [revokedIds, setRevokedIds] = useState<string[]>([]);
  const keys = (keysData?.data ?? []).filter((k) => !revokedIds.includes(k.id));
  // Later refetches keep the list on screen
  const initialLoading = loading && !keysData;
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);

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
    } catch (err) {
      console.error("Failed to create API key:", err);
      setError(t("apikeys.error_create"));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setKeyToRevoke(null);
    setError(null);
    setRevokedIds((ids) => [...ids, id]);
    const restore = () => {
      setRevokedIds((ids) => ids.filter((x) => x !== id));
      setError(t("apikeys.error_revoke", "Failed to revoke the API key."));
    };
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        refetchKeys();
      } else {
        restore();
      }
    } catch (err) {
      console.error("Failed to revoke API key:", err);
      restore();
    }
  };

  const handleCopy = async () => {
    if (!revealedToken) return;
    if (!(await copyText(revealedToken))) {
      toast.error(t("common.copy_failed"));
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const docsLinkClass =
    "inline-flex items-center justify-center font-medium text-sm px-4 py-2 rounded-[var(--radius)] transition-colors duration-100 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:ring-[var(--foreground-muted)]";

  return (
    <div className="space-y-6">
      <WarningModal
        open={keyToRevoke !== null}
        title={t("apikeys.revoke", "Revoke")}
        message={t("apikeys.confirm_revoke")}
        onConfirm={() => keyToRevoke && handleRevoke(keyToRevoke)}
        onCancel={() => setKeyToRevoke(null)}
      />
      <Card>
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          {t("apikeys.title", "API Keys")}
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] mb-6">
          {t(
            "apikeys.description",
            "Use API keys to authenticate scripting and CLI access. Keys inherit all your account permissions."
          )}
        </p>

        <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end mb-6">
          <div className="flex-1 min-w-[180px]">
            <Input
              type="text"
              label={t("apikeys.label_name", "Key name")}
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t("apikeys.placeholder_name", "e.g. My backup script")}
              maxLength={64}
            />
          </div>
          <div className="min-w-[180px]">
            <Input
              type="date"
              label={t("apikeys.label_expiry", "Expiration (optional)")}
              value={newKeyExpiry}
              onChange={(e) => setNewKeyExpiry(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={creating || !newKeyName.trim()}>
            {creating
              ? t("apikeys.creating", "Creating...")
              : t("apikeys.create_button", "Create key")}
          </Button>
        </form>

        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        {revealedToken && (
          <Alert variant="warning" className="mb-6 p-4">
            <p className="font-semibold mb-2">
              {t("apikeys.token_warning", "Save this key — it will not be shown again.")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-0 text-xs font-mono break-all bg-[var(--background)] px-3 py-2 rounded-[var(--radius)] border border-[var(--border)] text-[var(--foreground)]">
                {revealedToken}
              </code>
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? t("apikeys.copied", "Copied!") : t("apikeys.copy", "Copy")}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs">{t("apikeys.sharex_label", "ShareX:")}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadShareXConfig(window.location.origin, revealedToken, "files")}
              >
                {t("apikeys.sharex_files", "Download file uploader")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadShareXConfig(window.location.origin, revealedToken, "links")}
              >
                {t("apikeys.sharex_links", "Download URL shortener")}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => setRevealedToken(null)}
            >
              {t("apikeys.dismiss", "Dismiss")}
            </Button>
          </Alert>
        )}

        {initialLoading && (
          <p className="text-sm text-[var(--foreground-muted)]">{t("loading", "Loading...")}</p>
        )}
        {!initialLoading && keys.length === 0 && (
          <p className="text-sm text-[var(--foreground-muted)]">
            {t("apikeys.no_keys", "No API keys yet.")}
          </p>
        )}
        {!initialLoading && keys.length > 0 && (
          <ul className="space-y-3">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">
                    {key.name}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)] font-mono mt-0.5">
                    {key.keyPrefix}...
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)] mt-0.5 break-words">
                    {t("apikeys.created", "Created")} {formatDate(key.createdAt)}
                    {key.lastUsedAt &&
                      ` · ${t("apikeys.last_used", "Last used")} ${formatDate(key.lastUsedAt)}`}
                    {key.expiresAt &&
                      ` · ${t("apikeys.expires", "Expires")} ${formatDate(key.expiresAt)}`}
                  </p>
                </div>
                <Button variant="danger-outline" size="sm" onClick={() => setKeyToRevoke(key.id)}>
                  {t("apikeys.revoke", "Revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {t("apikeys.docs_title", "API Documentation")}
          </p>
          <p className="text-xs text-[var(--foreground-muted)]">
            {t(
              "apikeys.docs_description",
              "Browse the interactive API docs to explore all endpoints."
            )}
          </p>
        </div>
        <a href="/api-docs" target="_blank" rel="noopener noreferrer" className={docsLinkClass}>
          {t("apikeys.docs_link", "Open docs")}
        </a>
      </Card>
    </div>
  );
}
