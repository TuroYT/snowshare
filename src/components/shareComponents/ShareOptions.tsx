"use client";

import React from "react";
import { useTranslation } from "react-i18next";

interface ShareOptionsProps {
  /** i18n prefix for the title key (e.g. "linkshare", "fileshare", "pasteshare_ui") */
  translationPrefix: string;
  /** One-line recap shown while the block is collapsed */
  summary: string;
  children: React.ReactNode;
}

/** Collapsible block holding the optional settings (expiration, view limit, slug, note). */
const ShareOptions: React.FC<ShareOptionsProps> = ({ translationPrefix, summary, children }) => {
  const { t } = useTranslation();

  return (
    <details className="group border-y border-[var(--border)]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--foreground)]">
            {t(`${translationPrefix}.advanced`, "More options")}
          </span>
          <span className="block text-xs text-[var(--foreground-muted)] break-words">
            {summary}
          </span>
        </span>
        <svg
          className="w-4 h-4 flex-shrink-0 text-[var(--foreground-muted)] group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="space-y-5 pb-5 pt-3 [&>*+*]:border-t [&>*+*]:border-[var(--border)] [&>*+*]:pt-5">
        {children}
      </div>
    </details>
  );
};

export default ShareOptions;
