"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_ANON_EXPIRY_DAYS, MAX_AUTH_EXPIRY_DAYS } from "@/lib/share-constants";
import { useAuth } from "@/hooks/useAuth";
import { useShareSettings } from "@/hooks/useShareSettings";
import { useDefaultExpirationDays } from "@/hooks/useDefaultExpirationDays";

export interface UseShareFormOptions {
  /** Extra condition gating the Ctrl/Cmd+Enter submit shortcut (e.g. "content is non-empty"). */
  canSubmit?: () => boolean;
}

/**
 * Shared form state/behaviour for the FileShare, LinkShare and
 * ManageCodeBlock (PasteShare) forms:
 * - common fields: slug, password, neverExpires, expiresDays, view limit, loading/error/success state
 * - expiration computation, capped to MAX_ANON_EXPIRY_DAYS for anonymous users
 *   and MAX_AUTH_EXPIRY_DAYS for signed-in users (unified across all three forms)
 * - reset of the shared fields after a successful submission
 * - the Ctrl/Cmd+Enter submit shortcut, wired through a form ref rather than
 *   `document.querySelector("form")` so it targets this specific form only
 */
export function useShareForm(options: UseShareFormOptions = {}) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { defaultExpirationDays, loading: settingsLoading, ...restSettings } = useShareSettings();
  const [expiresDays, setExpiresDays] = useDefaultExpirationDays(
    isAuthenticated,
    authLoading,
    defaultExpirationDays,
    settingsLoading,
    MAX_ANON_EXPIRY_DAYS
  );

  const formRef = useRef<HTMLFormElement>(null);

  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [neverExpires, setNeverExpires] = useState(false);
  const [hasViewLimit, setHasViewLimit] = useState(false);
  const [maxViews, setMaxViews] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [successSlug, setSuccessSlug] = useState<string>("");

  // Keep the latest canSubmit/loading in refs so the keydown listener can be
  // registered once instead of re-bound on every render.
  const canSubmitRef = useRef(options.canSubmit);
  canSubmitRef.current = options.canSubmit;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "Enter" &&
        !loadingRef.current &&
        (!canSubmitRef.current || canSubmitRef.current())
      ) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /**
   * Computes the ISO expiresAt timestamp for the share being created, or
   * `null` when the share should never expire (only possible for signed-in
   * users who opted into "never expires"). Anonymous users are always capped
   * to MAX_ANON_EXPIRY_DAYS, signed-in users to MAX_AUTH_EXPIRY_DAYS.
   */
  const computeExpiresAt = (): string | null => {
    if (isAuthenticated && neverExpires) return null;
    const cap = isAuthenticated ? MAX_AUTH_EXPIRY_DAYS : MAX_ANON_EXPIRY_DAYS;
    const days = Math.max(1, Math.min(Number(expiresDays) || 1, cap));
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  };

  const resetAfterSuccess = () => {
    setSlug("");
    setPassword("");
    setNeverExpires(false);
    setHasViewLimit(false);
    setMaxViews(1);
  };

  return {
    isAuthenticated,
    authLoading,
    settingsLoading,
    shareSettings: { defaultExpirationDays, loading: settingsLoading, ...restSettings },
    formRef,
    slug,
    setSlug,
    password,
    setPassword,
    neverExpires,
    setNeverExpires,
    expiresDays,
    setExpiresDays,
    hasViewLimit,
    setHasViewLimit,
    maxViews,
    setMaxViews,
    loading,
    setLoading,
    error,
    setError,
    success,
    setSuccess,
    successSlug,
    setSuccessSlug,
    computeExpiresAt,
    resetAfterSuccess,
  };
}
