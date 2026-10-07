"use client";

import { useTranslation } from "react-i18next";
import { ToggleRow } from "./settings/primitives";

export interface EmbedsSectionSettings {
  socialEmbedsEnabled: boolean;
  embedPasteExcerpt: boolean;
}

interface Props {
  settings: EmbedsSectionSettings;
  onChange: (patch: Partial<EmbedsSectionSettings>) => void;
}

export default function EmbedsSection({ settings, onChange }: Readonly<Props>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{t("admin.embeds.title")}</h3>

      <ToggleRow
        label={t("admin.embeds.enabled")}
        description={t("admin.embeds.enabled_desc")}
        checked={settings.socialEmbedsEnabled}
        onChange={() => onChange({ socialEmbedsEnabled: !settings.socialEmbedsEnabled })}
      />

      {settings.socialEmbedsEnabled && (
        <ToggleRow
          label={t("admin.embeds.paste_excerpt")}
          description={t("admin.embeds.paste_excerpt_desc")}
          extra={
            settings.embedPasteExcerpt && (
              <p className="text-xs text-yellow-400 mt-1">
                {t("admin.embeds.paste_excerpt_warning")}
              </p>
            )
          }
          checked={settings.embedPasteExcerpt}
          onChange={() => onChange({ embedPasteExcerpt: !settings.embedPasteExcerpt })}
          activeColor="bg-yellow-500"
        />
      )}
    </div>
  );
}
