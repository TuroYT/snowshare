"use client";

import { useTranslation } from "react-i18next";
import { Input, Textarea } from "@/components/ui";

interface IdentitySectionProps {
  appName: string;
  appDescription: string;
  onChange: (key: "appName" | "appDescription", value: string) => void;
}

export default function IdentitySection({
  appName,
  appDescription,
  onChange,
}: Readonly<IdentitySectionProps>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {t("admin.branding.section_identity")}
      </h3>

      <div className="space-y-4 p-4 rounded-[var(--radius-lg)] border border-[var(--border)]">
        <Input
          label={t("admin.branding.app_name")}
          type="text"
          value={appName}
          onChange={(e) => onChange("appName", e.target.value)}
          placeholder="SnowShare"
          helperText={t("admin.branding.app_name_hint")}
        />

        <Textarea
          label={t("admin.branding.app_description")}
          value={appDescription}
          onChange={(e) => onChange("appDescription", e.target.value)}
          rows={2}
          placeholder="Share your files, pastes and URLs securely"
          helperText={t("admin.branding.app_description_hint")}
        />
      </div>
    </div>
  );
}
