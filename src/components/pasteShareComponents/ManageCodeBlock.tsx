"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import ExpirationSettings from "../shareComponents/ExpirationSettings";
import AdvancedSettings from "../shareComponents/AdvancedSettings";
import ViewLimitSettings from "../shareComponents/ViewLimitSettings";
import ShareSuccess from "../shareComponents/ShareSuccess";
import ShareError from "../shareComponents/ShareError";
import SubmitButton from "../shareComponents/SubmitButton";

const LANGUAGES = [
  { value: "plaintext", label: "Plain" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "php", label: "PHP" },
  { value: "go", label: "Go" },
  { value: "powershell", label: "PowerShell" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
];

const ManageCodeBlock: React.FC<{
  code: string;
  onCodeChange?: (v: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
}> = ({ code, language, onLanguageChange }) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const [slug, setSlug] = React.useState("");
  const [expiresDays, setExpiresDays] = React.useState<number>(isAuthenticated ? 30 : 7);
  const [neverExpires, setNeverExpires] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [hasViewLimit, setHasViewLimit] = React.useState(false);
  const [maxViews, setMaxViews] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [successSlug, setSuccessSlug] = React.useState<string>("");

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !loading && code.trim()) {
        e.preventDefault();
        const form = document.querySelector("form");
        if (form) form.requestSubmit();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loading, code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    let expiresAt: Date | undefined = undefined;
    if (!neverExpires) {
      const now = new Date();
      now.setDate(now.getDate() + expiresDays);
      expiresAt = now;
    }
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PASTE",
          paste: code,
          pastelanguage: language.toUpperCase(),
          expiresAt,
          slug,
          password,
          ...(hasViewLimit ? { maxViews } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setError(data?.error || t("pasteshare_ui.creation_error", "Failed to create share"));
      } else {
        const pasteShare = data?.share?.pasteShare;
        if (pasteShare?.slug) {
          setSuccess(`${window.location.origin}/p/${pasteShare.slug}`);
          setSuccessSlug(pasteShare.slug);
        } else if (pasteShare?.id) setSuccess(`${window.location.origin}/p/${pasteShare.id}`);
        else setSuccess(t("pasteshare_ui.created", "Share created"));
      }
    } catch {
      setError(t("pasteshare_ui.network_error", "Network error — could not create share"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ShareError error={error} translationPrefix="pasteshare_ui" />}

      {success && (
        <ShareSuccess url={success} slug={successSlug} translationPrefix="pasteshare_ui" />
      )}

      {/* Language selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--foreground)]">
          {t("pasteshare_ui.label_language")}
        </label>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="">{t("pasteshare_ui.language_placeholder")}</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <ExpirationSettings
        expiresDays={expiresDays}
        setExpiresDays={setExpiresDays}
        neverExpires={neverExpires}
        setNeverExpires={setNeverExpires}
        translationPrefix="linkshare"
        labelOverrides={{
          validityLabel: "pasteshare_ui.label_expiration",
          neverExpires: "pasteshare_ui.expiration_never",
          neverExpiresDesc: "pasteshare_ui.never_expires_desc",
        }}
      />

      <ViewLimitSettings
        hasViewLimit={hasViewLimit}
        setHasViewLimit={setHasViewLimit}
        maxViews={maxViews}
        setMaxViews={setMaxViews}
        translationPrefix="pasteshare_ui"
      />

      <AdvancedSettings
        slug={slug}
        setSlug={setSlug}
        password={password}
        setPassword={setPassword}
        slugPrefix="/p/"
        translationPrefix="pasteshare_ui"
        passwordLabelKey="pasteshare_ui.label_password"
      />

      <SubmitButton
        loading={loading}
        disabled={loading || !code.trim()}
        loadingText={t("pasteshare_ui.creating", "Creating...")}
        submitText={t("pasteshare_ui.submit", "Create paste")}
        iconPath="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
      />

      {!loading && code.trim() && (
        <p className="text-xs text-[var(--foreground-muted)] text-center mt-2">
          {t("pasteshare_ui.shortcut", "Tip:")}{" "}
          <kbd className="px-1 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs">
            Ctrl
          </kbd>{" "}
          +{" "}
          <kbd className="px-1 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs">
            Enter
          </kbd>{" "}
          {t("pasteshare_ui.shortcut_tail", "to create quickly")}
        </p>
      )}
    </form>
  );
};

export default ManageCodeBlock;
