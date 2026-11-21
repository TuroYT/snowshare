"use client";

import React, { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";

export interface UploadProgressHandle {
  setProgress: (percent: number) => void;
}

/**
 * Progress bar owning its own state: tus emits many progress events, and pushing them
 * through the parent form would re-render every field on each one.
 */
const UploadProgress = forwardRef<UploadProgressHandle>(function UploadProgress(_props, ref) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);

  useImperativeHandle(ref, () => ({ setProgress }), []);

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex justify-between text-sm text-[var(--foreground)]">
        <span>{t("fileshare.uploading", "Uploading...")}</span>
        <span>{t("fileshare.upload_progress", "Progress: {{progress}}%", { progress })}</span>
      </div>
      <div
        role="progressbar"
        aria-label={t("fileshare.uploading", "Uploading...")}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full bg-[var(--border)] rounded-full h-3"
      >
        <div
          className="h-3 rounded-full transition-[width] duration-200 ease-out bg-[var(--primary)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
});

export default UploadProgress;
