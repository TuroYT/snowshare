"use client";

import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl?: string;
  releaseName?: string;
  publishedAt?: string;
  releaseNotes?: string;
}

interface Props {
  versionInfo: VersionInfo | null;
  setVersionInfo: Dispatch<SetStateAction<VersionInfo | null>>;
}

export default function UpdateNotification({ versionInfo, setVersionInfo }: Readonly<Props>) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestVersion = versionInfo?.latestVersion ?? versionInfo?.currentVersion;

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch("/api/admin/version");
        if (response.ok) {
          const data = await response.json();
          setVersionInfo(data);

          // Check if this version was already dismissed
          const dismissedVersion = localStorage.getItem("snowshare_dismissed_version");
          if (dismissedVersion === (data.latestVersion ?? data.currentVersion)) {
            setDismissed(true);
          }
        }
      } catch (error) {
        console.error("Failed to check version:", error);
      } finally {
        setLoading(false);
      }
    };

    checkVersion();
  }, [setVersionInfo]);

  const handleDismiss = () => {
    if (latestVersion) {
      localStorage.setItem("snowshare_dismissed_version", latestVersion);
    }
    setDismissed(true);
  };

  if (loading || !versionInfo?.updateAvailable || dismissed) {
    return;
  }

  return (
    <div
      role="status"
      className="mb-6 p-4 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] border border-[color-mix(in_srgb,var(--primary)_30%,transparent)] rounded-[var(--radius-lg)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="p-2 bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] rounded-[var(--radius)] shrink-0">
            <svg
              className="w-5 h-5 text-[var(--foreground)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[var(--foreground)]">
              {t("admin.update.title", "Update Available")}
            </h3>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              {t("admin.update.description", "A new version of SnowShare is available.")}{" "}
              <span className="font-mono text-xs bg-[var(--surface)] px-1.5 py-0.5 rounded">
                {versionInfo.currentVersion}
              </span>
              {" → "}
              <span className="font-mono text-xs bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--foreground)] px-1.5 py-0.5 rounded">
                {latestVersion}
              </span>
            </p>
            {versionInfo.releaseName && (
              <p className="text-sm text-[var(--foreground-muted)] mt-1">
                <strong>{versionInfo.releaseName}</strong>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
              {versionInfo.releaseUrl && (
                <a
                  href={versionInfo.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)] underline underline-offset-2 decoration-[var(--primary)] hover:decoration-2 transition-colors duration-100 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  {t("admin.update.view_release", "View Release Notes")}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
              <a
                href="https://github.com/TuroYT/snowshare/blob/main/docs/UPGRADE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-100 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                {t("admin.update.upgrade_guide", "Upgrade Guide")}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-2 -m-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-[var(--radius)] transition-colors duration-100 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          title={t("admin.update.dismiss", "Dismiss")}
          aria-label={t("admin.update.dismiss", "Dismiss")}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
