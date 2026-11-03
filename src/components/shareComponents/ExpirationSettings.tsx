"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { MAX_ANON_EXPIRY_DAYS, MAX_AUTH_EXPIRY_DAYS } from "@/lib/share-constants";
import { useAuth } from "@/hooks/useAuth";
import { useDurationText } from "@/hooks/useShareSummary";
import { FIELD_FOCUS } from "./fieldStyles";

const MAX_DAYS_ANON = MAX_ANON_EXPIRY_DAYS;
const MAX_DAYS_AUTH = MAX_AUTH_EXPIRY_DAYS;

interface ExpirationSettingsProps {
  expiresDays: number;
  setExpiresDays: (days: number) => void;
  neverExpires: boolean;
  setNeverExpires: (value: boolean) => void;
  /** i18n prefix for translation keys (e.g. "linkshare", "fileshare") */
  translationPrefix: string;
  /** Extra info to append to the login hint (e.g. file size info) */
  extraLoginInfo?: string;
  /** Extra interpolation params for the login_for_more translation key */
  loginForMoreParams?: Record<string, unknown>;
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
  loginForMoreParams,
  labelOverrides,
}) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const durationText = useDurationText(translationPrefix, expiresDays, neverExpires);
  const daysId = React.useId();

  const neverExpiresLabel = t(
    labelOverrides?.neverExpires || `${translationPrefix}.never_expires`,
    "No expiration"
  );

  return (
    <div className="space-y-3">
      <label htmlFor={daysId} className="block text-sm font-medium text-[var(--foreground)]">
        {t(labelOverrides?.validityLabel || `${translationPrefix}.validity_label`, "Expires after")}
      </label>

      {isAuthenticated && (
        <label aria-label={neverExpiresLabel} className="flex items-center gap-4 cursor-pointer">
          <div className="relative flex-shrink-0">
            <input
              type="checkbox"
              role="switch"
              checked={neverExpires}
              onChange={(e) => setNeverExpires(e.target.checked)}
              className="peer sr-only"
            />
            <div
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--surface)] ${neverExpires ? "bg-[var(--primary)]" : "bg-[var(--border-hover)]"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${neverExpires ? "translate-x-4" : ""}`}
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--foreground)] mb-1">
              {neverExpiresLabel}
            </div>
            <div className="text-xs text-[var(--foreground-muted)] leading-relaxed">
              {t(
                labelOverrides?.neverExpiresDesc || `${translationPrefix}.never_expires_desc`,
                "This content will remain available indefinitely"
              )}
            </div>
          </div>
        </label>
      )}

      <div
        className={`flex items-center gap-3 ${isAuthenticated && neverExpires ? "opacity-50" : ""}`}
      >
        <div className="flex-1 min-w-0">
          <input
            id={daysId}
            type="number"
            min={1}
            max={isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON}
            value={expiresDays}
            onChange={(e) => setExpiresDays(Number(e.target.value))}
            disabled={isAuthenticated && neverExpires}
            className={`w-full bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed ${FIELD_FOCUS}`}
          />
        </div>
        <span className="text-sm text-[var(--foreground-muted)] min-w-0">
          {t(`${translationPrefix}.days`, "days")}
        </span>
      </div>

      <p className="text-xs text-[var(--foreground-muted)]">{durationText}</p>

      {!isAuthenticated && (
        <p className="text-xs text-[var(--foreground-muted)]">
          {t(
            `${translationPrefix}.login_for_more`,
            "Sign in for longer durations (up to {{max}} days) or no expiration",
            { max: MAX_DAYS_AUTH, ...loginForMoreParams }
          )}
          {extraLoginInfo && ` ${extraLoginInfo}`}
        </p>
      )}
    </div>
  );
};

export default ExpirationSettings;
