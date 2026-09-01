"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import WaveSkeleton from "@/components/ui/WaveSkeleton";
import SkeletonTransition from "@/components/ui/SkeletonTransition";
import MDEditor from "@uiw/react-md-editor";
import { toast } from "@/components/ui/Toast";
import WarningModal from "./WarningModal";
import GeneralSection from "./GeneralSection";
import CaptchaSection from "./CaptchaSection";
import SmtpSection from "./SmtpSection";
import QuotasSection from "./QuotasSection";
import ExpirationSection from "./ExpirationSection";
import S3StorageSection from "./S3StorageSection";

interface Settings {
  id: number;
  allowSignin: boolean;
  disableCredentialsLogin: boolean;
  allowAnonFileShare: boolean;
  allowAnonLinkShare: boolean;
  allowAnonPasteShare: boolean;
  anoMaxUpload: number;
  authMaxUpload: number;
  anoIpQuota: number;
  authIpQuota: number;
  defaultExpirationDays: number;
  useGiBForAnon: boolean;
  useGiBForAuth: boolean;
  termsOfUses: string;
  allowIframeEmbedding: boolean;
  captchaEnabled: boolean;
  captchaProvider: string | null;
  captchaSiteKey: string | null;
  captchaSecretKey: string | null;
  smtpEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  smtpSecure: boolean;
  emailVerificationRequired: boolean;
  s3Enabled: boolean;
  s3Endpoint: string | null;
  s3Region: string | null;
  s3Bucket: string | null;
  s3AccessKeyId: string | null;
  s3SecretAccessKey: string | null;
}

function mapSettingsWithDefaults(data: Settings): Settings {
  return {
    ...data,
    allowSignin: data.allowSignin ?? true,
    disableCredentialsLogin: data.disableCredentialsLogin ?? false,
    allowAnonFileShare: data.allowAnonFileShare ?? true,
    allowAnonLinkShare: data.allowAnonLinkShare ?? true,
    allowAnonPasteShare: data.allowAnonPasteShare ?? true,
    defaultExpirationDays: data.defaultExpirationDays ?? 30,
    allowIframeEmbedding: data.allowIframeEmbedding ?? false,
    captchaEnabled: data.captchaEnabled ?? false,
    captchaProvider: data.captchaProvider ?? null,
    captchaSiteKey: data.captchaSiteKey ?? null,
    captchaSecretKey: data.captchaSecretKey ?? null,
    smtpEnabled: data.smtpEnabled ?? false,
    smtpHost: data.smtpHost ?? null,
    smtpPort: data.smtpPort ?? 587,
    smtpUser: data.smtpUser ?? null,
    smtpPassword: data.smtpPassword ?? null,
    smtpFrom: data.smtpFrom ?? null,
    smtpSecure: data.smtpSecure ?? false,
    emailVerificationRequired: data.emailVerificationRequired ?? false,
    s3Enabled: data.s3Enabled ?? false,
    s3Endpoint: data.s3Endpoint ?? null,
    s3Region: data.s3Region ?? null,
    s3Bucket: data.s3Bucket ?? null,
    s3AccessKeyId: data.s3AccessKeyId ?? null,
    s3SecretAccessKey: data.s3SecretAccessKey ?? null,
  };
}

export default function SettingsTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hasActiveSSO, setHasActiveSSO] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data = await response.json();
      setHasActiveSSO(data.hasActiveSSO);
      setSettings(mapSettingsWithDefaults(data.settings));
    } catch (err) {
      toast.error(t("admin.error_load_data"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const handleConfirmDisableCredentials = () => {
    patchSettings({ disableCredentialsLogin: true, allowSignin: true });
    setShowWarningModal(false);
  };

  const handleMarkdownChange = (value: string | undefined) => {
    patchSettings({ termsOfUses: value || "" });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error("Failed to save settings");
      const data = await response.json();
      setSettings(data.settings);
      toast.success(t("admin.save_success"));
    } catch (err) {
      toast.error(t("admin.save_error"));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!settings && !loading) return null;

  const skeleton = (
    <div className="space-y-6 w-full">
      {[0, 1, 2].map((s) => (
        <div key={s} className="space-y-3">
          <WaveSkeleton variant="text" width={160} height={28} />
          {[0, 1, 2].map((r) => (
            <div
              key={r}
              className="flex items-center justify-between p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50"
            >
              <div className="flex-1 mr-8">
                <WaveSkeleton variant="text" width={192} height={22} />
                <WaveSkeleton variant="text" width={288} height={18} />
              </div>
              <WaveSkeleton
                variant="rounded"
                width={56}
                height={32}
                sx={{ borderRadius: "9999px", flexShrink: 0 }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <SkeletonTransition loading={loading} skeleton={skeleton} className="w-full">
      {settings && (
        <div className="space-y-6 w-full">
          <WarningModal
            open={showWarningModal}
            title={t("admin.settings.warning_disable_credentials_title")}
            message={t("admin.settings.warning_disable_credentials_message")}
            onConfirm={handleConfirmDisableCredentials}
            onCancel={() => setShowWarningModal(false)}
          />

          <GeneralSection
            settings={settings}
            hasActiveSSO={hasActiveSSO}
            onChange={patchSettings}
            onRequestDisableCredentials={() => setShowWarningModal(true)}
          />

          <QuotasSection settings={settings} onChange={patchSettings} />

          <ExpirationSection settings={settings} onChange={patchSettings} />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {t("footer.terms_of_use")}
            </h3>
            <MDEditor
              value={settings?.termsOfUses || ""}
              onChange={handleMarkdownChange}
              height={300}
            />
          </div>

          <CaptchaSection settings={settings} onChange={patchSettings} />

          <SmtpSection settings={settings} onChange={patchSettings} />

          <S3StorageSection settings={settings} onChange={patchSettings} />

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[var(--radius)] font-medium transition-colors disabled:opacity-50"
            >
              {saving ? t("admin.settings.saving") : t("admin.settings.save")}
            </button>
          </div>
        </div>
      )}
    </SkeletonTransition>
  );
}
