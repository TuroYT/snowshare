"use client";

import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/Alert";

interface ShareErrorProps {
  error: string;
  /** i18n prefix for translation keys (e.g. "linkshare", "fileshare") */
  translationPrefix: string;
}

const ShareError: React.FC<ShareErrorProps> = ({ error, translationPrefix }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [error]);

  return (
    <Alert ref={ref} variant="danger" className="mt-6 p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <svg
          aria-hidden="true"
          className="w-5 h-5 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="min-w-0">
          <h4 className="text-sm font-medium mb-1">
            {t(`${translationPrefix}.error_title`, "Error")}
          </h4>
          <p className="text-sm text-[var(--foreground)] break-words">{error}</p>
        </div>
      </div>
    </Alert>
  );
};

export default ShareError;
