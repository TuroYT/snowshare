"use client";

import React from "react";
import { useTranslation } from "react-i18next";

interface ShareErrorProps {
  error: string;
  /** i18n prefix for translation keys (e.g. "linkshare", "fileshare") */
  translationPrefix: string;
}

const ShareError: React.FC<ShareErrorProps> = ({ error, translationPrefix }) => {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="mt-6 bg-red-900/20 border border-red-800 rounded-lg p-4"
    >
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
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
        <div>
          <h4 className="text-sm font-medium text-red-300 mb-1">
            {t(`${translationPrefix}.error_title`, "Erreur")}
          </h4>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    </div>
  );
};

export default ShareError;
