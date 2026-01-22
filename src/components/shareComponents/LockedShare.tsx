import React from "react";
import { useTranslation } from "react-i18next";

interface LockedShareProps {
  /** Share type: 'link', 'file', or 'paste' */
  type: "link" | "file" | "paste";
  /** If true, displays a loading skeleton */
  isLoading: boolean;
  /** If true, displays the lock message */
  isLocked: boolean;
}

const LockedShare: React.FC<LockedShareProps> = ({ type, isLoading, isLocked }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] bg-opacity-95 p-6 rounded-2xl shadow-2xl border border-[var(--border)]/50 w-full max-w-2xl mx-auto text-center">
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--surface)] rounded w-1/2 mx-auto mb-4"></div>
          <div className="h-4 bg-[var(--surface)] rounded w-3/4 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!isLocked) {
    return null;
  }

  const titleKey = `${type}share.locked_title`;
  const messageKey = `${type}share.locked_message`;

  const defaultTitles: Record<string, string> = {
    link: "Link sharing is locked",
    file: "File sharing is locked",
    paste: "Paste sharing is locked",
  };

  const defaultMessages: Record<string, string> = {
    link: "You must be logged in to share links.",
    file: "You must be logged in to share files.",
    paste: "You must be logged in to share code.",
  };

  return (
    <div className="bg-[var(--surface)] bg-opacity-95 p-6 rounded-2xl shadow-2xl border border-[var(--border)]/50 w-full max-w-2xl mx-auto text-center">
      <div className="h-12 w-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-700/50 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
        {t(titleKey, defaultTitles[type])}
      </h2>
      <p className="text-[var(--foreground-muted)] mb-4">
        {t(messageKey, defaultMessages[type])}
      </p>
    </div>
  );
};

export default LockedShare;
