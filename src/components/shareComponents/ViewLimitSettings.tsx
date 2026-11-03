"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { FIELD_FOCUS } from "./fieldStyles";

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
  const viewLimitLabel = t(`${translationPrefix}.view_limit`, "Limit number of views");

  return (
    <div className="space-y-3">
      <label aria-label={viewLimitLabel} className="flex items-center gap-4 cursor-pointer">
        <div className="relative flex-shrink-0">
          <input
            type="checkbox"
            role="switch"
            checked={hasViewLimit}
            onChange={(e) => setHasViewLimit(e.target.checked)}
            className="peer sr-only"
          />
          <div
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--surface)] ${hasViewLimit ? "bg-[var(--primary)]" : "bg-[var(--border-hover)]"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${hasViewLimit ? "translate-x-4" : ""}`}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--foreground)] mb-1">
            {viewLimitLabel}
          </div>
          <div className="text-xs text-[var(--foreground-muted)] leading-relaxed">
            {t(
              `${translationPrefix}.view_limit_desc`,
              "The share will expire after a set number of views or downloads"
            )}
          </div>
        </div>
      </label>

      {hasViewLimit && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <input
                type="number"
                aria-label={viewLimitLabel}
                min={1}
                max={10000}
                value={maxViews}
                onChange={(e) => setMaxViews(Math.max(1, Number(e.target.value)))}
                className={`w-full bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 ${FIELD_FOCUS}`}
              />
            </div>
            <span className="text-sm text-[var(--foreground-muted)] min-w-0">
              {t(`${translationPrefix}.views`, "views")}
            </span>
          </div>
          <p className="text-xs text-[var(--foreground-muted)]">
            {t(
              `${translationPrefix}.view_limit_info`,
              "This share will expire after {{count}} view(s)/download(s)",
              { count: maxViews }
            )}
          </p>
        </>
      )}
    </div>
  );
};

export default ViewLimitSettings;
