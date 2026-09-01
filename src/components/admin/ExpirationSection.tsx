"use client";

import { useTranslation } from "react-i18next";

export interface ExpirationSectionSettings {
  defaultExpirationDays: number;
}

interface Props {
  settings: ExpirationSectionSettings;
  onChange: (patch: Partial<ExpirationSectionSettings>) => void;
}

export default function ExpirationSection({ settings, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary-dark)]/50 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-[var(--primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          {t("admin.expiration.title")}
        </h3>
      </div>

      <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
        <label className="text-sm text-[var(--foreground)]">
          {t("admin.expiration.default_days")}
        </label>
        <p className="text-xs text-[var(--foreground-muted)] mb-2">
          {t("admin.expiration.default_days_hint")}
        </p>
        <div className="flex items-center gap-3 max-w-xs">
          <div className="flex-1">
            <input
              type="number"
              min={1}
              max={365}
              value={settings.defaultExpirationDays}
              onChange={(e) => onChange({ defaultExpirationDays: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">
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
