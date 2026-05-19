"use client";

import { useTranslation } from "react-i18next";
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

function QuotaInput({ label, hint, value, onChange, unit, currentValueLabel }: QuotaInputProps) {
  return (
    <div>
      <label className="text-sm text-[var(--foreground)]">{label}</label>
      <p className="text-xs text-[var(--foreground-muted)] mb-2">{hint}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            min="0"
          />
        </div>
        <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">{unit}</span>
      </div>
      <p className="text-xs text-[var(--foreground-muted)] mt-1">{currentValueLabel}</p>
    </div>
  );
}

interface QuotaGroupProps {
  title: string;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  iconPath: string;
  useGiB: boolean;
  onToggleUnit: () => void;
  maxUpload: number;
  ipQuota: number;
  onChangeMax: (raw: number) => void;
  onChangeIp: (raw: number) => void;
}

function QuotaGroup({
  title,
  iconBg,
  iconBorder,
  iconColor,
  iconPath,
  useGiB,
  onToggleUnit,
  maxUpload,
  ipQuota,
  onChangeMax,
  onChangeIp,
}: QuotaGroupProps) {
  const { t } = useTranslation();
  const unit = useGiB ? "GiB" : "MiB";

  return (
    <div className="space-y-3 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
      <div className="flex items-center gap-2 mb-2 justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`h-6 w-6 rounded-lg ${iconBg} border ${iconBorder} flex items-center justify-center`}
          >
            <svg
              className={`w-3 h-3 ${iconColor}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
          </div>
          <label className="text-[var(--foreground)] font-medium">{title}</label>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--foreground-muted)]">
            {t("admin.quotas.unit_format")}
          </label>
          <button
            onClick={onToggleUnit}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              useGiB
                ? "bg-[var(--secondary)] text-white"
                : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            {unit}
          </button>
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

export default function QuotasSection({ settings, onChange }: Props) {
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          {t("admin.quotas.title")}
        </h3>
      </div>

      <QuotaGroup
        title={t("admin.quotas.section_anonymous")}
        iconBg="bg-[var(--primary)]/20"
        iconBorder="border-[var(--primary-dark)]/50"
        iconColor="text-[var(--primary)]"
        iconPath="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0z"
        useGiB={settings.useGiBForAnon}
        onToggleUnit={() => onChange({ useGiBForAnon: !settings.useGiBForAnon })}
        maxUpload={settings.anoMaxUpload}
        ipQuota={settings.anoIpQuota}
        onChangeMax={(raw) => onChange({ anoMaxUpload: convertToMB(raw, settings.useGiBForAnon) })}
        onChangeIp={(raw) => onChange({ anoIpQuota: convertToMB(raw, settings.useGiBForAnon) })}
      />

      <QuotaGroup
        title={t("admin.quotas.section_authenticated")}
        iconBg="bg-[var(--secondary)]/20"
        iconBorder="border-[var(--secondary-dark)]/50"
        iconColor="text-[var(--secondary)]"
        iconPath="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        useGiB={settings.useGiBForAuth}
        onToggleUnit={() => onChange({ useGiBForAuth: !settings.useGiBForAuth })}
        maxUpload={settings.authMaxUpload}
        ipQuota={settings.authIpQuota}
        onChangeMax={(raw) => onChange({ authMaxUpload: convertToMB(raw, settings.useGiBForAuth) })}
        onChangeIp={(raw) => onChange({ authIpQuota: convertToMB(raw, settings.useGiBForAuth) })}
      />

      <div className="p-4 bg-[var(--primary)]/10 border border-[var(--primary-dark)]/30 rounded-lg text-[var(--primary-hover)] text-sm">
        <p className="font-medium mb-2">💡 Info</p>
        <ul className="space-y-1 text-xs">
          <li>• {t("admin.quotas.max_file_size_hint")}</li>
          <li>• {t("admin.quotas.ip_quota_hint")}</li>
        </ul>
      </div>
    </div>
  );
}
