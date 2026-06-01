"use client";

import { useTranslation } from "react-i18next";
import { FieldInput, Toggle, ToggleRow } from "./settings/primitives";

export interface SmtpSectionSettings {
  smtpEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  smtpSecure: boolean;
  emailVerificationRequired: boolean;
}

interface Props {
  settings: SmtpSectionSettings;
  onChange: (patch: Partial<SmtpSectionSettings>) => void;
}

export default function SmtpSection({ settings, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {t("admin.settings.section_smtp")}
      </h3>

      <ToggleRow
        label={t("admin.settings.smtp_enabled")}
        description={t("admin.settings.smtp_enabled_desc")}
        checked={settings.smtpEnabled}
        onChange={() => onChange({ smtpEnabled: !settings.smtpEnabled })}
      />

      {settings.smtpEnabled && (
        <div className="space-y-3 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldInput
              label={t("admin.settings.smtp_host")}
              value={settings.smtpHost ?? ""}
              onChange={(v) => onChange({ smtpHost: v })}
              placeholder="smtp.example.com"
            />
            <FieldInput
              label={t("admin.settings.smtp_port")}
              type="number"
              value={settings.smtpPort ?? 587}
              onChange={(v) => onChange({ smtpPort: v ? parseInt(v) : 587 })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldInput
              label={t("admin.settings.smtp_user")}
              value={settings.smtpUser ?? ""}
              onChange={(v) => onChange({ smtpUser: v })}
              placeholder="user@example.com"
            />
            <FieldInput
              label={t("admin.settings.smtp_password")}
              type="password"
              value={settings.smtpPassword ?? ""}
              onChange={(v) => onChange({ smtpPassword: v })}
              placeholder={t("admin.settings.smtp_password_placeholder") as string}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldInput
              label={t("admin.settings.smtp_from")}
              value={settings.smtpFrom ?? ""}
              onChange={(v) => onChange({ smtpFrom: v })}
              placeholder="noreply@example.com"
              hint={t("admin.settings.smtp_from_hint") as string}
            />
            <div className="flex items-center justify-between gap-4 mt-6">
              <div className="flex-1 min-w-0">
                <label className="text-sm font-medium text-[var(--foreground)]">
                  {t("admin.settings.smtp_secure")}
                </label>
                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                  {t("admin.settings.smtp_secure_hint")}
                </p>
              </div>
              <Toggle
                checked={settings.smtpSecure}
                onChange={() => onChange({ smtpSecure: !settings.smtpSecure })}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border)]/30">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label className="text-[var(--foreground)] font-medium">
                  {t("admin.settings.email_verification_required")}
                </label>
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  {t("admin.settings.email_verification_required_desc")}
                </p>
              </div>
              <Toggle
                checked={settings.emailVerificationRequired}
                onChange={() =>
                  onChange({ emailVerificationRequired: !settings.emailVerificationRequired })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
