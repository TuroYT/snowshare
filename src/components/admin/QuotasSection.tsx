"use client";

import { useTranslation } from "react-i18next";
import { Alert, Button, Input } from "@/components/ui";
import { convertFromMB, convertToMB } from "@/lib/formatSize";

export interface QuotasSectionSettings {
  anoMaxUpload: number;
  authMaxUpload: number;
  anoIpQuota: number;
  authIpQuota: number;
  useGiBForAnon: boolean;
  useGiBForAuth: boolean;
}

interface Props {
  settings: QuotasSectionSettings;
  onChange: (patch: Partial<QuotasSectionSettings>) => void;
}

interface QuotaInputProps {
  label: string;
  hint: string;
  value: number;
  onChange: (raw: number) => void;
  unit: string;
  currentValueLabel: string;
}

function QuotaInput({
  label,
  hint,
  value,
  onChange,
  unit,
  currentValueLabel,
}: Readonly<QuotaInputProps>) {
  return (
    <div>
      <div className="flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <Input
            label={label}
            helperText={hint}
            type="number"
            value={value}
            onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 0)}
            min="0"
          />
        </div>
        <span className="text-sm text-[var(--foreground-muted)] pb-2">{unit}</span>
      </div>
      <p className="text-xs text-[var(--foreground-muted)] mt-1">{currentValueLabel}</p>
    </div>
  );
}

interface QuotaGroupProps {
  title: string;
  useGiB: boolean;
  onToggleUnit: () => void;
  maxUpload: number;
  ipQuota: number;
  onChangeMax: (raw: number) => void;
  onChangeIp: (raw: number) => void;
}

function QuotaGroup({
  title,
  useGiB,
  onToggleUnit,
  maxUpload,
  ipQuota,
  onChangeMax,
  onChangeIp,
}: Readonly<QuotaGroupProps>) {
  const { t } = useTranslation();
  const unit = useGiB ? "GiB" : "MiB";

  return (
    <div className="space-y-3 p-4 rounded-[var(--radius-lg)] border border-[var(--border)]">
      <div className="flex flex-wrap items-center gap-2 mb-2 justify-between">
        <h4 className="text-[var(--foreground)] font-medium">{title}</h4>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--foreground-muted)]">
            {t("admin.quotas.unit_format")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onToggleUnit}
            aria-label={`${t("admin.quotas.unit_format")}: ${unit}`}
          >
            {unit}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuotaInput
          label={t("admin.quotas.max_file_size")}
          hint={t("admin.quotas.max_file_size_hint")}
          value={convertFromMB(maxUpload, useGiB)}
          onChange={onChangeMax}
          unit={unit}
          currentValueLabel={t("admin.quotas.current_value", {
            value: convertFromMB(maxUpload, useGiB),
          })}
        />
        <QuotaInput
          label={t("admin.quotas.ip_quota")}
          hint={t("admin.quotas.ip_quota_hint")}
          value={convertFromMB(ipQuota, useGiB)}
          onChange={onChangeIp}
          unit={unit}
          currentValueLabel={t("admin.quotas.current_value", {
            value: convertFromMB(ipQuota, useGiB),
          })}
        />
      </div>
    </div>
  );
}

export default function QuotasSection({ settings, onChange }: Readonly<Props>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{t("admin.quotas.title")}</h3>

      <QuotaGroup
        title={t("admin.quotas.section_anonymous")}
        useGiB={settings.useGiBForAnon}
        onToggleUnit={() => onChange({ useGiBForAnon: !settings.useGiBForAnon })}
        maxUpload={settings.anoMaxUpload}
        ipQuota={settings.anoIpQuota}
        onChangeMax={(raw) => onChange({ anoMaxUpload: convertToMB(raw, settings.useGiBForAnon) })}
        onChangeIp={(raw) => onChange({ anoIpQuota: convertToMB(raw, settings.useGiBForAnon) })}
      />

      <QuotaGroup
        title={t("admin.quotas.section_authenticated")}
        useGiB={settings.useGiBForAuth}
        onToggleUnit={() => onChange({ useGiBForAuth: !settings.useGiBForAuth })}
        maxUpload={settings.authMaxUpload}
        ipQuota={settings.authIpQuota}
        onChangeMax={(raw) => onChange({ authMaxUpload: convertToMB(raw, settings.useGiBForAuth) })}
        onChangeIp={(raw) => onChange({ authIpQuota: convertToMB(raw, settings.useGiBForAuth) })}
      />

      <Alert variant="info">
        <p className="font-medium mb-2">{t("admin.branding.info_title", "Info")}</p>
        <ul className="space-y-1 text-xs">
          <li>• {t("admin.quotas.max_file_size_hint")}</li>
          <li>• {t("admin.quotas.ip_quota_hint")}</li>
        </ul>
      </Alert>
    </div>
  );
}
