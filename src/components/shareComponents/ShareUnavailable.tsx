"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/Alert";

const SECONDARY_LINK_BUTTON =
  "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-[var(--radius)] bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-hover)] transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:ring-[var(--foreground-muted)]";

/**
 * What a recipient sees when a public share cannot be opened (not found, expired, view limit
 * reached, network failure): the reason, and one way out.
 */
const ShareUnavailable: React.FC<{ message: string }> = ({ message }) => {
  const { t } = useTranslation();

  return (
    <div className="py-12 space-y-4 text-center">
      <Alert variant="danger" className="text-left break-words">
        {message}
      </Alert>
      <Link href="/" className={SECONDARY_LINK_BUTTON}>
        {t("file_download.back_to_home", "Back to home")}
      </Link>
    </div>
  );
};

export default ShareUnavailable;
