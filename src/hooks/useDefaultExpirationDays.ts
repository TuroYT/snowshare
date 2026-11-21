"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seeds `expiresDays` from the server default once auth/settings have loaded, without
 * overwriting a value the user already edited (the ref is set synchronously, so it also
 * wins when the user typed before the fetch resolved).
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
