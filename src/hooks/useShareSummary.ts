import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";

/** Human-readable expiration sentence, e.g. "This link will expire in 7 days". */
export function useDurationText(
  translationPrefix: string,
  expiresDays: number,
  neverExpires: boolean
): string {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return useMemo(() => {
    const days = expiresDays;
    if (isAuthenticated && neverExpires) return t(`${translationPrefix}.duration_never`);
    if (days === 1) return t(`${translationPrefix}.duration_in_1_day`);
    if (days < 7) return t(`${translationPrefix}.duration_in_x_days`, { count: days });
    if (days === 7) return t(`${translationPrefix}.duration_in_1_week`);
    if (days < 30)
      return t(`${translationPrefix}.duration_in_x_weeks`, { count: Math.round(days / 7) });
    if (days === 30) return t(`${translationPrefix}.duration_in_1_month`);
    if (days < 365)
      return t(`${translationPrefix}.duration_in_x_months`, { count: Math.round(days / 30) });
    return t(`${translationPrefix}.duration_in_x_years`, { count: Math.round(days / 365) });
  }, [expiresDays, neverExpires, isAuthenticated, translationPrefix, t]);
}

interface ShareSummaryInput {
  expiresDays: number;
  neverExpires: boolean;
  hasViewLimit: boolean;
  maxViews: number;
  hasPassword: boolean;
}

/**
 * One-line recap of the share options. `summary` covers expiration and view limit
 * (shown next to the collapsed options); `fullSummary` also mentions the password.
 */
export function useShareSummary(
  translationPrefix: string,
  { expiresDays, neverExpires, hasViewLimit, maxViews, hasPassword }: ShareSummaryInput
) {
  const { t } = useTranslation();
  const duration = useDurationText(translationPrefix, expiresDays, neverExpires);

  const parts = [duration];
  if (hasViewLimit) parts.push(t("shareform.summary_views", { count: maxViews }));
  const summary = parts.join(" · ");
  const fullSummary = hasPassword
    ? [summary, t("shareform.summary_password")].join(" · ")
    : summary;

  return { summary, fullSummary };
}
