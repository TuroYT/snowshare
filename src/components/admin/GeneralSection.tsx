"use client";

import { useTranslation } from "react-i18next";
import { ToggleRow } from "./settings/primitives";

export interface GeneralSectionSettings {
  allowSignin: boolean;
  disableCredentialsLogin: boolean;
  allowAnonFileShare: boolean;
  allowAnonLinkShare: boolean;
  allowAnonPasteShare: boolean;
  allowIframeEmbedding: boolean;
}

interface Props {
  settings: GeneralSectionSettings;
  hasActiveSSO: boolean;
  onChange: (patch: Partial<GeneralSectionSettings>) => void;
  onRequestDisableCredentials: () => void;
}

export default function GeneralSection({
  settings,
  hasActiveSSO,
  onChange,
  onRequestDisableCredentials,
}: Props) {
  const { t } = useTranslation();

  const handleToggleDisableCredentials = () => {
    if (!settings.disableCredentialsLogin) {
      onRequestDisableCredentials();
      return;
    }
    onChange({ disableCredentialsLogin: false });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {t("admin.settings.section_general")}
      </h3>

      <ToggleRow
        label={t("admin.settings.disable_credentials_login")}
        description={t("admin.settings.disable_credentials_login_desc")}
        extra={
          !hasActiveSSO && (
            <p className="text-xs text-red-400 mt-1">{t("admin.settings.no_sso_active")}</p>
          )
        }
        checked={settings.disableCredentialsLogin}
        onChange={handleToggleDisableCredentials}
        disabled={!hasActiveSSO}
      />

      {!settings.disableCredentialsLogin && (
        <ToggleRow
          label={t("admin.settings.allow_signup")}
          description={t("admin.settings.allow_signup_desc")}
          checked={settings.allowSignin}
          onChange={() => onChange({ allowSignin: !settings.allowSignin })}
        />
      )}

      <ToggleRow
        label={t("admin.settings.allow_anon_fileshare")}
        description={t("admin.settings.allow_anon_fileshare_desc")}
        checked={settings.allowAnonFileShare}
        onChange={() => onChange({ allowAnonFileShare: !settings.allowAnonFileShare })}
      />

      <ToggleRow
        label={t("admin.settings.allow_anon_linkshare")}
        description={t("admin.settings.allow_anon_linkshare_desc")}
        checked={settings.allowAnonLinkShare}
        onChange={() => onChange({ allowAnonLinkShare: !settings.allowAnonLinkShare })}
      />

      <ToggleRow
        label={t("admin.settings.allow_anon_pasteshare")}
        description={t("admin.settings.allow_anon_pasteshare_desc")}
        checked={settings.allowAnonPasteShare}
        onChange={() => onChange({ allowAnonPasteShare: !settings.allowAnonPasteShare })}
      />

      <ToggleRow
        label={t("admin.settings.allow_iframe_embedding")}
        description={t("admin.settings.allow_iframe_embedding_desc")}
        extra={
          settings.allowIframeEmbedding && (
            <p className="text-xs text-yellow-400 mt-1">
              {t("admin.settings.allow_iframe_embedding_warning")}
            </p>
          )
        }
        checked={settings.allowIframeEmbedding}
        onChange={() => onChange({ allowIframeEmbedding: !settings.allowIframeEmbedding })}
        activeColor="bg-yellow-500"
      />
    </div>
  );
}
