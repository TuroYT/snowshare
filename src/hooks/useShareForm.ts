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
 * Shared state for the FileShare, LinkShare and PasteShare forms. The Ctrl/Cmd+Enter
 * shortcut goes through `formRef` so it only submits this form.
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
  const [successSummary, setSuccessSummary] = useState("");

  // Refs let the keydown listener be registered once instead of on every render
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

  /** ISO expiry date, or `null` for "never expires" (signed-in users only). Capped per user type. */
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

  const clearSuccess = () => {
    setSuccess(null);
    setSuccessSlug("");
    setSuccessSummary("");
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
    successSummary,
    setSuccessSummary,
    clearSuccess,
    computeExpiresAt,
    resetAfterSuccess,
  };
}
