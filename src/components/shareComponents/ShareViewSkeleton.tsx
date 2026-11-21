"use client";

import { useTranslation } from "react-i18next";
import WaveSkeleton from "@/components/ui/WaveSkeleton";

/** Placeholder sized like the loaded file/paste/upload-request page, to avoid a layout jump. */
export default function ShareViewSkeleton({ bodyHeight }: Readonly<{ bodyHeight: number }>) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("loading", "Loading...")}</span>
      <div className="mb-6">
        <WaveSkeleton variant="rounded" width={56} height={22} sx={{ mb: 1.5 }} />
        <WaveSkeleton variant="text" width={220} height={28} />
      </div>
      <WaveSkeleton
        variant="rounded"
        height={bodyHeight}
        sx={{ borderRadius: "var(--radius-lg)" }}
      />
    </div>
  );
}
