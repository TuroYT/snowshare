"use client";

import React from "react";
import { useTranslation } from "react-i18next";

interface AdvancedSettingsProps {
  slug: string;
  setSlug: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  /** URL path prefix for the slug (e.g. "/l/", "/p/", "/f/") */
  slugPrefix: string;
  /** i18n prefix for translation keys (e.g. "linkshare", "fileshare", "pasteshare_ui") */
  translationPrefix: string;
  /** Override the password label i18n key (defaults to translationPrefix.password_protect) */
  passwordLabelKey?: string;
}

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  slug,
  setSlug,
  password,
  setPassword,
  slugPrefix,
  translationPrefix,
  passwordLabelKey,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50 space-y-4">
      <h3 className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
          />
        </svg>
        {t(`${translationPrefix}.advanced`, "Paramètres avancés (optionnel)")}
      </h3>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="slug"
            className="block text-sm font-medium text-[var(--foreground)] mb-2"
          >
            {t(`${translationPrefix}.custom_slug`, "Lien personnalisé")}
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center items-start gap-2">
            <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">
              {typeof window !== "undefined"
                ? window.location.origin + slugPrefix
                : slugPrefix}
            </span>
            <input
              id="slug"
              type="text"
              placeholder={t(
                `${translationPrefix}.placeholder_slug`,
                "mon-lien-custom"
              )}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              pattern="[a-zA-Z0-9-_]+"
              className="input-paste flex-1 w-full"
            />
          </div>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {t(
              `${translationPrefix}.slug_hint`,
              "Lettres, chiffres, tirets et underscores uniquement"
            )}
          </p>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-[var(--foreground)] mb-2"
          >
            {t(
              passwordLabelKey || `${translationPrefix}.password_protect`,
              "Protection par mot de passe"
            )}
          </label>
          <div className="relative">
            <input
              id="password"
              type="password"
              placeholder={t(
                `${translationPrefix}.password_placeholder`,
                "Optionnel - laissez vide pour un accès libre"
              )}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-paste w-full pr-10"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <svg
                className="w-4 h-4 text-[var(--foreground-muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-5a2 2 0 00-2-2H6a2 2 0 00-2 2v5a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettings;
