"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FieldInput, Toggle } from "./settings/primitives";

export interface S3SectionSettings {
  s3Enabled: boolean;
  s3Endpoint: string | null;
  s3Region: string | null;
  s3Bucket: string | null;
  s3AccessKeyId: string | null;
  s3SecretAccessKey: string | null;
}

interface Props {
  settings: S3SectionSettings;
  onChange: (patch: Partial<S3SectionSettings>) => void;
}

export default function S3StorageSection({ settings, onChange }: Props) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/settings/test-s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: t("admin.settings.s3_test_success") });
      } else {
        setTestResult({
          success: false,
          message: t("admin.settings.s3_test_error", { error: data.error }),
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: t("admin.settings.s3_test_error", { error: "Network error" }),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {t("admin.settings.section_s3")}
      </h3>

      <div className="flex items-center justify-between gap-4 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
        <div className="flex-1 min-w-0">
          <label className="text-[var(--foreground)] font-medium">
            {t("admin.settings.s3_enabled")}
          </label>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            {t("admin.settings.s3_enabled_desc")}
          </p>
        </div>
        <Toggle
          checked={settings.s3Enabled}
          onChange={() => onChange({ s3Enabled: !settings.s3Enabled })}
        />
      </div>

      {settings.s3Enabled && (
        <div className="space-y-3 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldInput
              label={t("admin.settings.s3_bucket")}
              value={settings.s3Bucket ?? ""}
              onChange={(v) => onChange({ s3Bucket: v })}
              placeholder="my-bucket"
            />
            <FieldInput
              label={t("admin.settings.s3_region")}
              value={settings.s3Region ?? ""}
              onChange={(v) => onChange({ s3Region: v })}
              placeholder="us-east-1"
            />
          </div>

          <FieldInput
            label={t("admin.settings.s3_endpoint")}
            value={settings.s3Endpoint ?? ""}
            onChange={(v) => onChange({ s3Endpoint: v })}
            placeholder="https://s3.example.com"
            hint={t("admin.settings.s3_endpoint_hint") as string}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldInput
              label={t("admin.settings.s3_access_key_id")}
              value={settings.s3AccessKeyId ?? ""}
              onChange={(v) => onChange({ s3AccessKeyId: v })}
              placeholder="AKIAIOSFODNN7EXAMPLE"
            />
            <FieldInput
              label={t("admin.settings.s3_secret_access_key")}
              type="password"
              value={settings.s3SecretAccessKey ?? ""}
              onChange={(v) => onChange({ s3SecretAccessKey: v })}
              placeholder={t("admin.settings.s3_secret_access_key_placeholder") as string}
            />
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-xs text-yellow-400">{t("admin.settings.s3_env_priority")}</p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleTest}
              disabled={testing || !settings.s3Bucket}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface)]"
            >
              {testing ? t("admin.settings.s3_testing") : t("admin.settings.s3_test")}
            </button>

            {testResult && (
              <span
                className={`text-sm font-medium ${testResult.success ? "text-green-400" : "text-red-400"}`}
              >
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
