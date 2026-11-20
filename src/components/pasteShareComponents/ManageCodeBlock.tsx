"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { useShareForm } from "@/hooks/useShareForm";
import ExpirationSettings from "@/components/shareComponents/ExpirationSettings";
import PasswordField from "@/components/shareComponents/PasswordField";
import ShareOptions from "@/components/shareComponents/ShareOptions";
import ShortcutHint from "@/components/shareComponents/ShortcutHint";
import { FIELD_FOCUS } from "@/components/shareComponents/fieldStyles";
import { useShareSummary } from "@/hooks/useShareSummary";
import AdvancedSettings from "@/components/shareComponents/AdvancedSettings";
import ViewLimitSettings from "@/components/shareComponents/ViewLimitSettings";
import ShareSuccess from "@/components/shareComponents/ShareSuccess";
import ShareError from "@/components/shareComponents/ShareError";
import SubmitButton from "@/components/shareComponents/SubmitButton";

const LANGUAGES = [
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
  language: string;
  onLanguageChange: (lang: string) => void;
  /** Called when the user asks for a new share after a successful one (e.g. to clear the editor) */
  onNewShare?: () => void;
}> = ({ code, language, onLanguageChange, onNewShare }) => {
  const { t } = useTranslation();
  const languageId = React.useId();

  const {
    formRef,
    slug,
    setSlug,
    expiresDays,
    setExpiresDays,
    neverExpires,
    setNeverExpires,
    password,
    setPassword,
    hasViewLimit,
    setHasViewLimit,
    maxViews,
    setMaxViews,
    loading,
    setLoading,
    error,
    setError,
    success,
    setSuccess,
    successSlug,
    setSuccessSlug,
    successSummary,
    setSuccessSummary,
    clearSuccess,
    computeExpiresAt,
    resetAfterSuccess,
  } = useShareForm({ canSubmit: () => !!code.trim() });

  const { summary, fullSummary } = useShareSummary("linkshare", {
    expiresDays,
    neverExpires,
    hasViewLimit,
    maxViews,
    hasPassword: !!password.trim(),
  });

  const handleNewShare = () => {
    clearSuccess();
    onNewShare?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const expiresAt = computeExpiresAt();
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
        setSuccessSummary(fullSummary);
        resetAfterSuccess();
      }
    } catch (error) {
      console.error("ManageCodeBlock error:", error);
      setError(t("pasteshare_ui.network_error", "Network error — could not create share"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {error && <ShareError error={error} translationPrefix="pasteshare_ui" />}

      {success && (
        <ShareSuccess
          url={success}
          slug={successSlug}
          translationPrefix="pasteshare_ui"
          summary={successSummary}
          onNewShare={handleNewShare}
        />
      )}

      {/* Language selection */}
      <div className="space-y-2">
        <label htmlFor={languageId} className="block text-sm font-medium text-[var(--foreground)]">
          {t("pasteshare_ui.label_language", "Language")}
        </label>
        <select
          id={languageId}
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className={`w-full bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 ${FIELD_FOCUS}`}
        >
          <option value="">{t("pasteshare_ui.language_placeholder", "Select a language")}</option>
          <option value="plaintext">{t("pasteshare_ui.language_plain", "Plain text")}</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <PasswordField
        password={password}
        setPassword={setPassword}
        label={t("pasteshare_ui.label_password", "Password (optional)")}
        placeholder={t(
          "pasteshare_ui.password_placeholder",
          "Optional - leave empty for open access"
        )}
        help={t(
          "pasteshare_ui.password_help",
          "Required to read the text, which is also encrypted with it."
        )}
      />

      <ShareOptions translationPrefix="pasteshare_ui" summary={summary}>
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
          slugPrefix="/p/"
          translationPrefix="pasteshare_ui"
        />
      </ShareOptions>

      <SubmitButton
        loading={loading}
        disabled={loading || !code.trim()}
        loadingText={t("pasteshare_ui.creating", "Creating...")}
        submitText={t("pasteshare_ui.submit", "Create paste")}
        iconPath="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
      />

      {!loading && code.trim() && <ShortcutHint translationPrefix="pasteshare_ui" />}
    </form>
  );
};

export default ManageCodeBlock;
