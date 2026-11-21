"use client";

import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/Spinner";

export default function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center bg-[var(--background)] animate-fade-in-delayed"
    >
      <Spinner size="lg" />
      <span className="sr-only">{t("loading", "Loading...")}</span>
    </div>
  );
}
