"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seeds `expiresDays` from the server-provided default once auth/settings have
 * loaded, but never overwrites a value the user has already started editing
 * (userEdited ref is set synchronously on every manual change, so it wins
 * even if the user typed before the settings/auth fetch resolved).
 */
export function useDefaultExpirationDays(
  isAuthenticated: boolean,
  authLoading: boolean,
  defaultExpirationDays: number,
  settingsLoading: boolean,
  maxDaysAnon: number
): [number, (days: number) => void] {
  const [expiresDays, setExpiresDays] = useState<number>(isAuthenticated ? 30 : maxDaysAnon);
  const applied = useRef(false);
  const userEdited = useRef(false);

  useEffect(() => {
    if (applied.current || userEdited.current || settingsLoading || authLoading) return;
    applied.current = true;
    setExpiresDays(
      isAuthenticated ? defaultExpirationDays : Math.min(defaultExpirationDays, maxDaysAnon)
    );
  }, [settingsLoading, authLoading, isAuthenticated, defaultExpirationDays, maxDaysAnon]);

  const updateExpiresDays = (days: number) => {
    userEdited.current = true;
    setExpiresDays(days);
  };

  return [expiresDays, updateExpiresDays];
}
