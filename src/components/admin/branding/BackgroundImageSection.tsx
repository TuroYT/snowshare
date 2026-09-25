"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";

interface BackgroundImageSectionProps {
  backgroundImageUrl: string | null;
  onChange: (key: "backgroundImageUrl", value: string | null) => void;
}

export default function BackgroundImageSection({
  backgroundImageUrl,
  onChange,
}: BackgroundImageSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="p-4 bg-[var(--surface-hover)] rounded-[var(--radius-lg)] border border-[var(--border)]">
      <h4 className="text-sm font-semibold text-[var(--foreground)] mb-4">
        {t("admin.branding.background_image_url", "Background image")}
      </h4>
      <input
        type="url"
        value={backgroundImageUrl || ""}
        onChange={(e) => onChange("backgroundImageUrl", e.target.value || null)}
        className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--foreground)]"
        placeholder="https://example.com/background.jpg"
      />
      <p className="text-xs text-[var(--foreground-muted)] mt-1">
        {t("admin.branding.background_image_url_hint")}
      </p>
      {backgroundImageUrl && (
        <div className="mt-3 p-2 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)]">
          <p className="text-xs text-[var(--foreground-muted)] mb-2">
            {t("admin.branding.background_image_preview")}
          </p>
          <BackgroundImagePreview url={backgroundImageUrl} />
        </div>
      )}
    </div>
  );
}

function BackgroundImagePreview({ url }: { url: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
    const img = new window.Image();
    img.onload = () => setStatus("ok");
    img.onerror = () => setStatus("error");
    img.src = url;
  }, [url]);

  if (status === "loading") {
    return (
      <div className="w-full h-32 rounded-lg flex items-center justify-center bg-[var(--surface)]/30">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full h-32 rounded-lg flex flex-col items-center justify-center bg-red-900/20 border border-red-800/50 text-red-400 text-sm gap-2">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        {t(
          "admin.branding.background_image_error",
          "Unable to load image. Check that the URL points to a valid image."
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-32 rounded-lg overflow-hidden">
      <Image
        src={url}
        alt="Background preview"
        fill
        className="object-cover"
        onError={() => setStatus("error")}
      />
    </div>
  );
}
