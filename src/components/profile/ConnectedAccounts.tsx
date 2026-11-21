"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import WaveSkeleton from "@/components/ui/WaveSkeleton";
import SkeletonTransition from "@/components/ui/SkeletonTransition";
import { providerIcons } from "@/lib/providers-icons";
import { useFetch } from "@/hooks/useFetch";
import { Alert, Badge, Button, Card, Modal } from "@/components/ui";

type Account = {
  id: string;
  provider: string;
  providerAccountId: string;
  type: string;
};

type AvailableProvider = {
  id: string;
  name: string;
  displayName?: string;
};

const DISMISS_BUTTON_CLASS =
  "shrink-0 -my-1.5 -mr-1.5 h-9 w-9 inline-flex items-center justify-center rounded-[var(--radius)] hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-current";

function DismissibleAlert({
  variant,
  iconPath,
  onDismiss,
  children,
}: Readonly<{
  variant: "danger" | "success";
  iconPath: string;
  onDismiss: () => void;
  children: React.ReactNode;
}>) {
  const { t } = useTranslation();
  return (
    <Alert variant={variant} className="p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <svg
            className="w-5 h-5 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
          </svg>
          <p className="min-w-0 break-words">{children}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className={DISMISS_BUTTON_CLASS}
          aria-label={t("common.close", "Close")}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </Alert>
  );
}

export default function ConnectedAccounts() {
  const { t } = useTranslation();
  const {
    data: accountsData,
    loading,
    error: accountsError,
    refetch: refetchAccounts,
    clearError: clearAccountsError,
  } = useFetch<{ accounts: Account[] }>("/api/user/accounts", {
    errorMessage: t("profile.accounts.error_fetch"),
  });
  const { data: providersData } = useFetch<{ providers: AvailableProvider[] }>(
    "/api/oauth-providers"
  );

  const accounts = accountsData?.accounts ?? [];
  const availableProviders = providersData?.providers ?? [];

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);

  const displayError = error ?? accountsError;

  const validateLinkToken = useCallback(
    async (token: string) => {
      try {
        const res = await fetch("/api/user/accounts/validate-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          setSuccess(t("profile.accounts.unlink_success"));
          refetchAccounts();
        } else {
          const data = await res.json();
          setError(data.error || t("profile.accounts.error_link"));
        }
      } catch (err) {
        console.error("Failed to process account token:", err);
        setError(t("profile.accounts.error_link"));
      } finally {
        window.history.replaceState({}, "", window.location.pathname + "?tab=accounts");
      }
    },
    [refetchAccounts, t]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkToken = params.get("linkToken");
    const linked = params.get("linked");

    if (linked === "true") {
      setSuccess(t("profile.accounts.unlink_success"));
      window.history.replaceState({}, "", window.location.pathname + "?tab=accounts");
    } else if (linkToken) {
      validateLinkToken(linkToken);
    }
  }, [t, validateLinkToken]);

  const handleLinkAccount = async (provider: string) => {
    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/user/accounts/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (res.ok) {
        const data = await res.json();
        window.location.href = data.linkUrl;
      } else {
        const data = await res.json();
        setError(data.error || t("profile.accounts.error_link"));
      }
    } catch (err) {
      console.error("Failed to start account linking:", err);
      setError(t("profile.accounts.error_link"));
    }
  };

  const handleDeleteClick = (account: Account) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/user/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: accountToDelete.id }),
      });

      if (res.ok) {
        refetchAccounts();
        setSuccess(t("profile.accounts.unlink_success"));
      } else {
        const data = await res.json();
        setError(data.error || t("profile.accounts.error_unlink"));
      }
    } catch (err) {
      console.error("Failed to unlink account:", err);
      setError(t("profile.accounts.error_unlink"));
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    }
  };

  const getProviderDisplayName = (provider: string) => {
    const found = availableProviders.find((p) => p.name === provider);
    return found?.displayName || provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  const isProviderLinked = (provider: string) => {
    return accounts.some((a) => a.provider === provider);
  };

  const skeleton = (
    <Card>
      <div className="flex items-center gap-4 mb-6">
        <WaveSkeleton variant="rounded" width={48} height={48} sx={{ flexShrink: 0 }} />
        <div>
          <WaveSkeleton variant="text" width={176} height={28} />
          <WaveSkeleton variant="text" width={240} height={20} />
        </div>
      </div>
      <WaveSkeleton variant="text" width={160} height={26} sx={{ mb: 1.5 }} />
      <div className="space-y-2 mb-6">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 border border-[var(--border)] rounded-[var(--radius)]"
          >
            <div className="flex items-center gap-3">
              <WaveSkeleton variant="circular" width={24} height={24} />
              <div>
                <WaveSkeleton variant="text" width={120} height={20} />
                <WaveSkeleton variant="text" width={160} height={16} />
              </div>
            </div>
            <WaveSkeleton variant="rounded" width={36} height={36} />
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--border)] pt-6">
        <WaveSkeleton variant="text" width={192} height={26} sx={{ mb: 1.5 }} />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <WaveSkeleton key={i} variant="rounded" width={110} height={38} />
          ))}
        </div>
      </div>
    </Card>
  );

  // Only the first load shows the skeleton: later refetches keep the cards and the dialog mounted
  return (
    <SkeletonTransition loading={loading && !accountsData} skeleton={skeleton}>
      <>
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 shrink-0 rounded-[var(--radius)] border border-[var(--primary)]/30 bg-[var(--primary)]/10 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-[var(--primary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                {t("profile.accounts.title")}
              </h2>
              <p className="text-sm text-[var(--foreground-muted)]">
                {t("profile.accounts.description")}
              </p>
            </div>
          </div>

          {displayError && (
            <DismissibleAlert
              variant="danger"
              iconPath="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              onDismiss={() => {
                setError(null);
                clearAccountsError();
              }}
            >
              {displayError}
            </DismissibleAlert>
          )}

          {success && (
            <DismissibleAlert
              variant="success"
              iconPath="M5 13l4 4L19 7"
              onDismiss={() => setSuccess(null)}
            >
              {success}
            </DismissibleAlert>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-3">
              {t("profile.accounts.connected")}
            </h3>
            {accounts.length === 0 ? (
              <p className="text-sm text-[var(--foreground-muted)]">
                {t("profile.accounts.no_connected")}
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between gap-3 p-4 border border-[var(--border)] rounded-[var(--radius)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-[var(--primary)] shrink-0" aria-hidden="true">
                        {providerIcons[account.provider] || (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--foreground)] break-words">
                          {getProviderDisplayName(account.provider)}
                        </p>
                        <p className="text-xs text-[var(--foreground-muted)] break-all">
                          {account.providerAccountId}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(account)}
                      className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-[var(--radius)] text-[var(--foreground-muted)] hover:bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] hover:text-[var(--destructive-text)] transition-colors duration-100"
                      aria-label={t("profile.accounts.unlink")}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-3">
              {t("profile.accounts.available")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {availableProviders.map((provider) => (
                <Button
                  key={provider.id}
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => handleLinkAccount(provider.name)}
                  disabled={isProviderLinked(provider.name)}
                >
                  <span className="text-[var(--primary)]" aria-hidden="true">
                    {providerIcons[provider.name] || (
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
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                    )}
                  </span>
                  {provider.displayName || provider.name}
                  {isProviderLinked(provider.name) && (
                    <Badge variant="success">{t("profile.accounts.linked")}</Badge>
                  )}
                </Button>
              ))}
              {availableProviders.length === 0 && (
                <p className="text-sm text-[var(--foreground-muted)]">
                  {t("profile.accounts.no_available")}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Modal
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title={t("profile.accounts.confirm_unlink")}
          size="sm"
        >
          <p className="text-sm text-[var(--foreground-muted)] mb-6">
            {t("profile.accounts.confirm_unlink_message", {
              provider: accountToDelete ? getProviderDisplayName(accountToDelete.provider) : "",
            })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger-outline"
              className="flex-1"
              onClick={handleDeleteConfirm}
              isLoading={deleting}
            >
              {t("profile.accounts.unlink")}
            </Button>
          </div>
        </Modal>
      </>
    </SkeletonTransition>
  );
}
