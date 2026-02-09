"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";

const MAX_DAYS_ANON = 7;
const MAX_DAYS_AUTH = 365;

interface ExpirationSettingsProps {
  expiresDays: number;
  setExpiresDays: (days: number) => void;
  neverExpires: boolean;
  setNeverExpires: (value: boolean) => void;
  /** i18n prefix for translation keys (e.g. "linkshare", "fileshare") */
  translationPrefix: string;
  /** Extra info to append to the login hint (e.g. file size info) */
  extraLoginInfo?: string;
  /** Override i18n keys for labels (defaults to translationPrefix-based keys) */
  labelOverrides?: {
    validityLabel?: string;
    neverExpires?: string;
    neverExpiresDesc?: string;
  };
}

const ExpirationSettings: React.FC<ExpirationSettingsProps> = ({
  expiresDays,
  setExpiresDays,
  neverExpires,
  setNeverExpires,
  translationPrefix,
  extraLoginInfo,
  labelOverrides,
}) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const getDurationText = () => {
    const days = expiresDays;
    if (isAuthenticated && neverExpires)
      return t(`${translationPrefix}.duration_never`);
    if (days === 1) return t(`${translationPrefix}.duration_in_1_day`);
    if (days < 7)
      return t(`${translationPrefix}.duration_in_x_days`, { count: days });
    if (days === 7) return t(`${translationPrefix}.duration_in_1_week`);
    if (days < 30)
      return t(`${translationPrefix}.duration_in_x_weeks`, {
        count: Math.round(days / 7),
      });
    if (days === 30) return t(`${translationPrefix}.duration_in_1_month`);
    if (days < 365)
      return t(`${translationPrefix}.duration_in_x_months`, {
        count: Math.round(days / 30),
      });
    return t(`${translationPrefix}.duration_in_x_years`, {
      count: Math.round(days / 365),
    });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[var(--foreground)]">
        {t(labelOverrides?.validityLabel || `${translationPrefix}.validity_label`, "Durée de validité")}
      </label>

      {isAuthenticated && (
        <div className="bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50">
          <label className="flex items-center gap-4 cursor-pointer hover:bg-[var(--surface)]/30 rounded-lg p-3 -m-3 transition-colors">
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                checked={neverExpires}
                onChange={(e) => setNeverExpires(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`toggle-slider ${
                  neverExpires ? "toggle-slider-active" : ""
                }`}
              >
                <div
                  className={`toggle-slider-thumb ${
                    neverExpires ? "toggle-slider-thumb-active" : ""
                  }`}
                ></div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--foreground)] mb-1">
                {t(
                  labelOverrides?.neverExpires || `${translationPrefix}.never_expires`,
                  "Aucune expiration"
                )}
              </div>
              <div className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                {t(
                  labelOverrides?.neverExpiresDesc || `${translationPrefix}.never_expires_desc`,
                  "Ce contenu restera disponible indéfiniment"
                )}
              </div>
            </div>
          </label>
        </div>
      )}

      <div
        className={`flex items-center gap-3 ${
          isAuthenticated && neverExpires ? "opacity-50" : ""
        }`}
      >
        <div className="flex-1">
          <input
            type="number"
            min={1}
            max={isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON}
            value={expiresDays}
            onChange={(e) => setExpiresDays(Number(e.target.value))}
            disabled={isAuthenticated && neverExpires}
            className="input-paste w-full disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <span className="text-sm text-[var(--foreground-muted)] min-w-0">
          {t(`${translationPrefix}.days`, "jours")}
        </span>
      </div>

      <div className="text-xs text-[var(--foreground-muted)] bg-[var(--surface)]/30 p-3 rounded-xl border border-[var(--border)]/30">
        <div className="flex items-center gap-2">
          <svg
            className="w-3 h-3 text-[var(--primary)] flex-shrink-0"
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
          <span>{getDurationText()}</span>
        </div>
      </div>

      {!isAuthenticated && (
        <p className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded p-2 text-[var(--foreground-muted)]">
          💡{" "}
          {t(
            `${translationPrefix}.login_for_more`,
            "Connectez-vous pour des durées plus longues (jusqu'à {{max}} jours) ou sans expiration",
            { max: MAX_DAYS_AUTH }
          )}
          {extraLoginInfo && ` ${extraLoginInfo}`}
        </p>
      )}
    </div>
  );
};

export default ExpirationSettings;
