"use client";

import React from "react";
import { useTranslation } from "react-i18next";

interface ViewLimitSettingsProps {
  hasViewLimit: boolean;
  setHasViewLimit: (value: boolean) => void;
  maxViews: number;
  setMaxViews: (value: number) => void;
  /** i18n prefix for translation keys (e.g. "linkshare", "fileshare") */
  translationPrefix: string;
}

const ViewLimitSettings: React.FC<ViewLimitSettingsProps> = ({
  hasViewLimit,
  setHasViewLimit,
  maxViews,
  setMaxViews,
  translationPrefix,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50">
        <label className="flex items-center gap-4 cursor-pointer hover:bg-[var(--surface)]/30 rounded-lg p-3 -m-3 transition-colors">
          <div className="relative flex-shrink-0">
            <input
              type="checkbox"
              checked={hasViewLimit}
              onChange={(e) => setHasViewLimit(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${hasViewLimit ? "bg-[var(--primary)]" : "bg-[var(--border-hover)]"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${hasViewLimit ? "translate-x-4" : ""}`}
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--foreground)] mb-1">
              {t(`${translationPrefix}.view_limit`, "View/download limit")}
            </div>
            <div className="text-xs text-[var(--foreground-muted)] leading-relaxed">
              {t(
                `${translationPrefix}.view_limit_desc`,
                "The share will expire after a set number of views or downloads"
              )}
            </div>
          </div>
        </label>
      </div>

      {hasViewLimit && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="number"
              min={1}
              max={10000}
              value={maxViews}
              onChange={(e) => setMaxViews(Math.max(1, Number(e.target.value)))}
              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <span className="text-sm text-[var(--foreground-muted)] min-w-0">
            {t(`${translationPrefix}.views`, "views")}
          </span>
        </div>
      )}

      {hasViewLimit && (
        <div className="text-xs text-[var(--foreground-muted)] bg-[var(--surface)]/30 p-3 rounded-xl border border-[var(--border)]/30">
          <div className="flex items-center gap-2">
            <svg
              className="w-3 h-3 text-[var(--primary)] flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              {t(
                `${translationPrefix}.view_limit_info`,
                "This share will expire after {{count}} view(s)/download(s)",
                { count: maxViews }
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewLimitSettings;
