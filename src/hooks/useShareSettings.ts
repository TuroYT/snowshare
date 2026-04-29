"use client";

import { useMemo } from "react";
import { useFetch } from "./useFetch";

interface ApiSettingsResponse {
  settings: {
    allowAnonFileShare?: boolean;
    allowAnonLinkShare?: boolean;
    allowAnonPasteShare?: boolean;
    anoMaxUpload?: number;
    authMaxUpload?: number;
    useGiBForAnon?: boolean;
    useGiBForAuth?: boolean;
  };
}

export interface ShareSettings {
  allowAnonFileShare: boolean;
  allowAnonLinkShare: boolean;
  allowAnonPasteShare: boolean;
  /** Max upload size for anonymous users, in bytes */
  anoMaxUploadBytes: number;
  /** Max upload size for authenticated users, in bytes */
  authMaxUploadBytes: number;
  useGiBForAnon: boolean;
  useGiBForAuth: boolean;
  loading: boolean;
}

const MB = 1024 * 1024;

const DEFAULTS: Omit<ShareSettings, "loading"> = {
  allowAnonFileShare: true,
  allowAnonLinkShare: true,
  allowAnonPasteShare: true,
  anoMaxUploadBytes: 50 * MB,
  authMaxUploadBytes: 500 * MB,
  useGiBForAnon: false,
  useGiBForAuth: false,
};

export function useShareSettings(): ShareSettings {
  const { data, loading } = useFetch<ApiSettingsResponse>("/api/settings");

  return useMemo(() => {
    if (!data?.settings) return { ...DEFAULTS, loading };

    const s = data.settings;
    return {
      allowAnonFileShare: s.allowAnonFileShare ?? true,
      allowAnonLinkShare: s.allowAnonLinkShare ?? true,
      allowAnonPasteShare: s.allowAnonPasteShare ?? true,
      anoMaxUploadBytes: s.anoMaxUpload != null ? s.anoMaxUpload * MB : DEFAULTS.anoMaxUploadBytes,
      authMaxUploadBytes:
        s.authMaxUpload != null ? s.authMaxUpload * MB : DEFAULTS.authMaxUploadBytes,
      useGiBForAnon: s.useGiBForAnon ?? false,
      useGiBForAuth: s.useGiBForAuth ?? false,
      loading,
    };
  }, [data, loading]);
}
