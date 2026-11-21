"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button } from "@/components/ui";
import { FieldInput, ToggleRow } from "./settings/primitives";

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

export default function S3StorageSection({ settings, onChange }: Readonly<Props>) {
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
    } catch (error) {
      console.error("S3 connection test failed:", error);
      setTestResult({
        success: false,
        message: t("admin.settings.s3_test_error", { error: t("admin.settings.s3_network_error") }),
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

      <ToggleRow
        label={t("admin.settings.s3_enabled")}
        description={t("admin.settings.s3_enabled_desc")}
        checked={settings.s3Enabled}
        onChange={() => onChange({ s3Enabled: !settings.s3Enabled })}
      />

      {settings.s3Enabled && (
        <div className="space-y-3 p-4 rounded-[var(--radius-lg)] border border-[var(--border)]">
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

          <Alert variant="warning" className="text-xs">
            {t("admin.settings.s3_env_priority")}
          </Alert>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={handleTest}
              disabled={testing || !settings.s3Bucket}
            >
              {testing ? t("admin.settings.s3_testing") : t("admin.settings.s3_test")}
            </Button>

            {testResult && (
              <span
                role="status"
                className={`text-sm font-medium ${testResult.success ? "text-[var(--success-text)]" : "text-[var(--destructive-text)]"}`}
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
