"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShareForm } from "@/hooks/useShareForm";
import LockedShare from "./shareComponents/LockedShare";
import ExpirationSettings from "./shareComponents/ExpirationSettings";
import PasswordField from "./shareComponents/PasswordField";
import ShareOptions from "./shareComponents/ShareOptions";
import ShortcutHint from "./shareComponents/ShortcutHint";
import { FIELD_FOCUS } from "./shareComponents/fieldStyles";
import { useShareSummary } from "@/hooks/useShareSummary";
import AdvancedSettings from "./shareComponents/AdvancedSettings";
import ViewLimitSettings from "./shareComponents/ViewLimitSettings";
import ShareSuccess from "./shareComponents/ShareSuccess";
import ShareError from "./shareComponents/ShareError";
import SubmitButton from "./shareComponents/SubmitButton";
import ShareFormSkeleton from "./ShareFormSkeleton";
import SkeletonTransition from "@/components/ui/SkeletonTransition";

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const LinkShare: React.FC = () => {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const {
    isAuthenticated,
    shareSettings: { allowAnonLinkShare, loading: settingsLoading },
    formRef,
    slug,
    setSlug,
    password,
    setPassword,
    neverExpires,
    setNeverExpires,
    expiresDays,
    setExpiresDays,
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
  } = useShareForm({ canSubmit: () => !!url.trim() && !urlError });

  const { summary, fullSummary } = useShareSummary("linkshare", {
    expiresDays,
    neverExpires,
    hasViewLimit,
    maxViews,
    hasPassword: !!password.trim(),
  });
  const urlId = React.useId();
  const urlErrorId = `${urlId}-error`;

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setUrlError(null);
    if (value.trim() && !isValidUrl(value.trim())) {
      setUrlError(t("linkshare.url_error", "Invalid URL format"));
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!url.trim()) {
      setError(t("linkshare.url_required", "URL is required"));
      return;
    }
    if (!isValidUrl(url.trim())) {
      setError(t("linkshare.url_invalid", "The provided URL is not valid"));
      return;
    }

    const expiresAt = computeExpiresAt();

    const payload: Record<string, unknown> = {
      type: "URL",
      urlOriginal: url.trim(),
    };
    if (expiresAt) payload.expiresAt = expiresAt;
    if (slug.trim()) payload.slug = slug.trim();
    if (password.trim()) payload.password = password.trim();
    if (hasViewLimit) payload.maxViews = maxViews;

    try {
      setLoading(true);
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || t("linkshare.creation_error", "Failed to create share"));
      } else {
        const linkShare = data?.share?.linkShare;
        if (linkShare?.slug) {
          setSuccess(`${window.location.origin}/l/${linkShare.slug}`);
          setSuccessSlug(linkShare.slug);
        } else if (linkShare?.id) setSuccess(`${window.location.origin}/l/${linkShare.id}`);
        else setSuccess(t("linkshare.created", "Share created"));
        setSuccessSummary(fullSummary);
        setUrl("");
        resetAfterSuccess();
        setUrlError(null);
      }
    } catch (error) {
      console.error("LinkShare error:", error);
      setError(t("linkshare.network_error", "Network error — could not create share"));
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthenticated && !settingsLoading && allowAnonLinkShare === false) {
    return <LockedShare type="link" isLoading={false} isLocked={true} />;
  }

  return (
    <SkeletonTransition
      loading={settingsLoading}
      skeleton={<ShareFormSkeleton />}
      className="w-full"
    >
      <div className="bg-[var(--surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--border)] w-full max-w-2xl mx-auto text-left">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-center">
            <svg
              className="w-6 h-6 text-[var(--primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">
              {t("linkshare.title", "Share a link")}
            </h2>
            <p className="text-sm text-[var(--foreground-muted)]">
              {t("linkshare.subtitle", "Create a shareable link for any URL")}
            </p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          {/* URL input */}
          <div className="space-y-2">
            <label htmlFor={urlId} className="block text-sm font-medium text-[var(--foreground)]">
              {t("linkshare.label_url", "URL to share")}&nbsp;
              <span className="text-[var(--destructive)]" aria-hidden="true">
                *
              </span>
            </label>
            <div className="relative">
              <input
                id={urlId}
                type="url"
                placeholder={t("linkshare.placeholder_url", "https://example.com/my-page")}
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                required
                aria-invalid={!!urlError}
                aria-describedby={urlError ? urlErrorId : undefined}
                className={`w-full bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 pr-10 ${FIELD_FOCUS} ${
                  urlError ? "border-[var(--destructive)]" : ""
                }`}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {url && isValidUrl(url) && (
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5 text-[var(--success)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </div>
            {urlError && (
              <p id={urlErrorId} className="text-xs text-[var(--destructive)] mt-1">
                {urlError}
              </p>
            )}
          </div>

          <PasswordField
            password={password}
            setPassword={setPassword}
            label={t("linkshare.password_protect", "Password protection")}
            placeholder={t(
              "linkshare.password_placeholder",
              "Optional - leave empty for open access"
            )}
            help={t(
              "linkshare.password_help",
              "Visitors must enter this password to open the link."
            )}
          />

          <ShareOptions translationPrefix="linkshare" summary={summary}>
            <ExpirationSettings
              expiresDays={expiresDays}
              setExpiresDays={setExpiresDays}
              neverExpires={neverExpires}
              setNeverExpires={setNeverExpires}
              translationPrefix="linkshare"
            />

            <ViewLimitSettings
              hasViewLimit={hasViewLimit}
              setHasViewLimit={setHasViewLimit}
              maxViews={maxViews}
              setMaxViews={setMaxViews}
              translationPrefix="linkshare"
            />

            <AdvancedSettings
              slug={slug}
              setSlug={setSlug}
              slugPrefix="/l/"
              translationPrefix="linkshare"
            />
          </ShareOptions>

          <SubmitButton
            loading={loading}
            disabled={loading || !url.trim() || !!urlError}
            loadingText={t("linkshare.creating", "Creating...")}
            submitText={t("linkshare.submit", "Create shared link")}
            iconPath="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
          />

          {!loading && url.trim() && !urlError && <ShortcutHint translationPrefix="linkshare" />}
        </form>

        {error && <ShareError error={error} translationPrefix="linkshare" />}

        {success && (
          <ShareSuccess
            url={success}
            slug={successSlug}
            translationPrefix="linkshare"
            summary={successSummary}
            onNewShare={clearSuccess}
          />
        )}
      </div>
    </SkeletonTransition>
  );
};

export default LinkShare;
