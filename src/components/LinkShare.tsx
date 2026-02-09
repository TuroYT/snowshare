"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import LockedShare from "./shareComponents/LockedShare";
import ExpirationSettings from "./shareComponents/ExpirationSettings";
import AdvancedSettings from "./shareComponents/AdvancedSettings";
import ViewLimitSettings from "./shareComponents/ViewLimitSettings";
import ShareSuccess from "./shareComponents/ShareSuccess";
import ShareError from "./shareComponents/ShareError";
import SubmitButton from "./shareComponents/SubmitButton";

const MAX_DAYS_ANON = 7;
const MAX_DAYS_AUTH = 365;

const LinkShare: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [expiresDays, setExpiresDays] = useState<number>(
    isAuthenticated ? 30 : MAX_DAYS_ANON
  );
  const [neverExpires, setNeverExpires] = useState(false);
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [hasViewLimit, setHasViewLimit] = useState(false);
  const [maxViews, setMaxViews] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [allowAnonLinkShare, setAllowAnonLinkShare] = useState<boolean | null>(
    null
  );
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Fetch settings to check if anonymous link sharing is allowed
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setAllowAnonLinkShare(data.settings?.allowAnonLinkShare ?? true);
        } else {
          setAllowAnonLinkShare(true);
        }
      } catch {
        setAllowAnonLinkShare(true);
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  function isValidUrl(value: string) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setUrlError(null);
    if (value.trim() && !isValidUrl(value.trim())) {
      setUrlError(t("linkshare.url_error", "Format d'URL invalide"));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "Enter" &&
        url.trim() &&
        !urlError &&
        !loading
      ) {
        e.preventDefault();
        const form = document.querySelector("form");
        if (form) form.requestSubmit();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [url, urlError, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!url.trim()) {
      setError(t("linkshare.url_required", "L'URL est requise"));
      return;
    }
    if (!isValidUrl(url.trim())) {
      setError(t("linkshare.url_invalid", "L'URL fournie n'est pas valide"));
      return;
    }

    let expiresAt: string | null = null;
    if (!isAuthenticated || !neverExpires) {
      const cap = isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON;
      const days = Math.max(1, Math.min(Number(expiresDays) || 1, cap));
      expiresAt = new Date(
        Date.now() + days * 24 * 60 * 60 * 1000
      ).toISOString();
    }

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
        setError(
          data?.error ||
            t(
              "linkshare.creation_error",
              "Erreur lors de la création du partage"
            )
        );
      } else {
        const linkShare = data?.share?.linkShare;
        if (linkShare?.slug)
          setSuccess(`${window.location.origin}/l/${linkShare.slug}`);
        else if (linkShare?.id)
          setSuccess(`${window.location.origin}/l/${linkShare.id}`);
        else setSuccess(t("linkshare.created", "Partage créé"));
        setUrl("");
        setSlug("");
        setPassword("");
        setNeverExpires(false);
        setHasViewLimit(false);
        setMaxViews(1);
        setUrlError(null);
      }
    } catch (error) {
      console.error("LinkShare error:", error);
      setError(
        t(
          "linkshare.network_error",
          "Erreur réseau — impossible de créer le partage"
        )
      );
    } finally {
      setLoading(false);
    }
  }

  if (settingsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!isAuthenticated && allowAnonLinkShare === false) {
    return (
      <LockedShare
        type="link"
        isLoading={settingsLoading}
        isLocked={!allowAnonLinkShare}
      />
    );
  }

  return (
    <div className="bg-[var(--surface)] bg-opacity-95 p-6 rounded-2xl shadow-2xl border border-[var(--border)]/50 w-full max-w-2xl mx-auto text-left">
      <div className="flex items-center gap-4 mb-6 justify-center">
        <div
          className="h-12 w-12 rounded-xl border border-[var(--primary-dark)]/50 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(to bottom right, rgb(from var(--primary) r g b / 0.2), rgb(from var(--primary-dark) r g b / 0.2))",
          }}
        >
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
            {t("linkshare.title", "Partager un lien")}
          </h2>
          <p className="text-sm text-[var(--foreground-muted)]">
            {t(
              "linkshare.subtitle",
              "Créez un lien partageable pour n'importe quelle URL"
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* URL input */}
        <div className="space-y-2">
          <label
            htmlFor="url"
            className="block text-sm font-medium text-[var(--foreground)]"
          >
            {t("linkshare.label_url", "URL à partager")}&nbsp;
            <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="url"
              type="url"
              placeholder={t(
                "linkshare.placeholder_url",
                "https://exemple.com/ma-page"
              )}
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              required
              className={`input-paste w-full pr-10 ${
                urlError ? "border-red-500 focus:ring-red-500" : ""
              }`}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {url && isValidUrl(url) && (
                <svg
                  className="w-5 h-5 text-green-400"
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
          {urlError && <p className="text-xs text-red-400 mt-1">{urlError}</p>}
        </div>

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
          password={password}
          setPassword={setPassword}
          slugPrefix="/l/"
          translationPrefix="linkshare"
        />

        <SubmitButton
          loading={loading}
          disabled={loading || !url.trim() || !!urlError}
          loadingText={t("linkshare.creating", "Création en cours...")}
          submitText={t("linkshare.submit", "Créer le lien partagé")}
          iconPath="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
        />

        {!loading && url.trim() && !urlError && (
          <p className="text-xs text-[var(--foreground-muted)] text-center mt-2">
            💡 {t("linkshare.shortcut", "Astuce :")}{" "}
            <kbd className="px-1 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs">
              Ctrl
            </kbd>{" "}
            +{" "}
            <kbd className="px-1 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs">
              Entrée
            </kbd>{" "}
            {t("linkshare.shortcut_tail", "pour créer rapidement")}
          </p>
        )}
      </form>

      {error && <ShareError error={error} translationPrefix="linkshare" />}

      {success && (
        <ShareSuccess url={success} translationPrefix="linkshare" />
      )}
    </div>
  );
};

export default LinkShare;
