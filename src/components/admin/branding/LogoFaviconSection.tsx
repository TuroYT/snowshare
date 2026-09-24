"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

interface LogoFaviconSectionProps {
  logoUrl: string | null;
  faviconUrl: string | null;
  onChange: (key: "logoUrl" | "faviconUrl", value: string | null) => void;
}

export default function LogoFaviconSection({
  logoUrl,
  faviconUrl,
  onChange,
}: LogoFaviconSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-[var(--secondary)]/20 border border-[var(--secondary-dark)]/50 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-[var(--secondary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          {t("admin.branding.section_images")}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Logo URL */}
        <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <label className="text-sm text-[var(--foreground)] block mb-2">
            {t("admin.branding.logo_url")}
          </label>
          <input
            type="url"
            value={logoUrl || ""}
            onChange={(e) => onChange("logoUrl", e.target.value || null)}
            className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="https://example.com/logo.png"
          />
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {t("admin.branding.logo_url_hint")}
          </p>
          {logoUrl && (
            <div className="mt-3 p-2 bg-[var(--surface)]/50 rounded-lg">
              <p className="text-xs text-[var(--foreground-muted)] mb-2">
                {t("admin.branding.preview")}
              </p>
              <Image
                src={logoUrl}
                alt="Logo preview"
                width={120}
                height={40}
                className="h-10 w-auto object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        {/* Favicon URL */}
        <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <label className="text-sm text-[var(--foreground)] block mb-2">
            {t("admin.branding.favicon_url")}
          </label>
          <input
            type="url"
            value={faviconUrl || ""}
            onChange={(e) => onChange("faviconUrl", e.target.value || null)}
            className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="https://example.com/favicon.ico"
          />
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {t("admin.branding.favicon_url_hint")}
          </p>
          {faviconUrl && (
            <div className="mt-3 p-2 bg-[var(--surface)]/50 rounded-lg">
              <p className="text-xs text-[var(--foreground-muted)] mb-2">
                {t("admin.branding.preview")}
              </p>
              <Image
                src={faviconUrl}
                alt="Favicon preview"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
