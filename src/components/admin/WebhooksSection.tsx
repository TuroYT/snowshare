"use client";

import { useTranslation } from "react-i18next";
import { FieldInput } from "./settings/primitives";

export interface WebhooksSectionSettings {
  webhookUrl: string | null;
  webhookSecret: string | null;
}

interface Props {
  settings: WebhooksSectionSettings;
  onChange: (patch: Partial<WebhooksSectionSettings>) => void;
}

export default function WebhooksSection({ settings, onChange }: Readonly<Props>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {t("admin.webhooks.title")}
      </h3>
      <p className="text-sm text-[var(--foreground-muted)]">{t("admin.webhooks.description")}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldInput
          label={t("admin.webhooks.url")}
          value={settings.webhookUrl ?? ""}
          onChange={(v) => onChange({ webhookUrl: v })}
          placeholder="https://example.com/hooks/snowshare"
        />
        <FieldInput
          label={t("admin.webhooks.secret")}
          type="password"
          value={settings.webhookSecret ?? ""}
          onChange={(v) => onChange({ webhookSecret: v })}
          hint={t("admin.webhooks.secret_hint") as string}
        />
      </div>
    </div>
  );
}
