"use client";

import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/Spinner";

export default function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex justify-center items-center min-h-screen bg-[var(--background)] pointer-events-none"
      style={{ animation: "fadeOut 0.6s ease-out 2s forwards" }}
    >
      <Spinner className="w-16 h-16" />
      <span className="sr-only">{t("loading", "Loading...")}</span>
      <style>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
