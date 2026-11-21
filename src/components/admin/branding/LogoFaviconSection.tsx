"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui";

interface LogoFaviconSectionProps {
  logoUrl: string | null;
  faviconUrl: string | null;
  onChange: (key: "logoUrl" | "faviconUrl", value: string | null) => void;
}

export default function LogoFaviconSection({
  logoUrl,
  faviconUrl,
  onChange,
}: Readonly<LogoFaviconSectionProps>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {t("admin.branding.section_images")}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Logo URL */}
        <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--border)]">
          <Input
            label={t("admin.branding.logo_url")}
            type="url"
            value={logoUrl || ""}
            onChange={(e) => onChange("logoUrl", e.target.value || null)}
            placeholder="https://example.com/logo.png"
            helperText={t("admin.branding.logo_url_hint")}
          />
          {logoUrl && (
            <div className="mt-3 p-2 rounded-[var(--radius)] border border-[var(--border)]">
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
        <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--border)]">
          <Input
            label={t("admin.branding.favicon_url")}
            type="url"
            value={faviconUrl || ""}
            onChange={(e) => onChange("faviconUrl", e.target.value || null)}
            placeholder="https://example.com/favicon.ico"
            helperText={t("admin.branding.favicon_url_hint")}
          />
          {faviconUrl && (
            <div className="mt-3 p-2 rounded-[var(--radius)] border border-[var(--border)]">
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
