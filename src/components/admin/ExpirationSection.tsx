"use client";

import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui";

export interface ExpirationSectionSettings {
  defaultExpirationDays: number;
}

interface Props {
  settings: ExpirationSectionSettings;
  onChange: (patch: Partial<ExpirationSectionSettings>) => void;
}

export default function ExpirationSection({ settings, onChange }: Readonly<Props>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {t("admin.expiration.title")}
      </h3>

      <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--border)]">
        <div className="flex items-end gap-3 max-w-xs">
          <div className="flex-1 min-w-0">
            <Input
              label={t("admin.expiration.default_days")}
              helperText={t("admin.expiration.default_days_hint")}
              type="number"
              min={1}
              max={365}
              value={settings.defaultExpirationDays}
              onChange={(e) =>
                onChange({ defaultExpirationDays: Number.parseInt(e.target.value) || 1 })
              }
            />
          </div>
          <span className="text-sm text-[var(--foreground-muted)] pb-2">
            {t("admin.expiration.days_unit")}
          </span>
        </div>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          {t("admin.expiration.current_value", { value: settings.defaultExpirationDays })}
        </p>
      </div>
    </div>
  );
}
