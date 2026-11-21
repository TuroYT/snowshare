"use client";

import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui";
import { FieldInput, ToggleRow } from "./settings/primitives";

export interface CaptchaSectionSettings {
  captchaEnabled: boolean;
  captchaProvider: string | null;
  captchaSiteKey: string | null;
  captchaSecretKey: string | null;
}

interface Props {
  settings: CaptchaSectionSettings;
  onChange: (patch: Partial<CaptchaSectionSettings>) => void;
}

export default function CaptchaSection({ settings, onChange }: Readonly<Props>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {t("admin.settings.section_captcha")}
      </h3>

      <ToggleRow
        label={t("admin.settings.captcha_enabled")}
        description={t("admin.settings.captcha_enabled_desc")}
        checked={settings.captchaEnabled}
        onChange={() => onChange({ captchaEnabled: !settings.captchaEnabled })}
      />

      {settings.captchaEnabled && (
        <div className="space-y-3 p-4 rounded-[var(--radius-lg)] border border-[var(--border)]">
          <Select
            label={t("admin.settings.captcha_provider")}
            value={settings.captchaProvider ?? ""}
            onChange={(e) => onChange({ captchaProvider: e.target.value || null })}
          >
            <option value="">{t("admin.settings.captcha_provider_select")}</option>
            <option value="recaptcha">Google reCAPTCHA v2</option>
            <option value="turnstile">Cloudflare Turnstile</option>
          </Select>

          <FieldInput
            label={t("admin.settings.captcha_site_key")}
            value={settings.captchaSiteKey ?? ""}
            onChange={(v) => onChange({ captchaSiteKey: v })}
            placeholder={t("admin.settings.captcha_site_key_placeholder") as string}
          />

          <FieldInput
            label={t("admin.settings.captcha_secret_key")}
            type="password"
            value={settings.captchaSecretKey ?? ""}
            onChange={(v) => onChange({ captchaSecretKey: v })}
            placeholder={t("admin.settings.captcha_secret_key_placeholder") as string}
            hint={t("admin.settings.captcha_secret_key_hint") as string}
          />
        </div>
      )}
    </div>
  );
}
