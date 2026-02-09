"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { providerIcons } from "@/lib/providers-icons";

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


export default function ConnectedAccounts() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchAvailableProviders();
    const params = new URLSearchParams(window.location.search);
    const linkToken = params.get("linkToken");
    const linked = params.get("linked");

    if (linked === "true") {
      setSuccess(t("profile.accounts.unlink_success"));
      window.history.replaceState({}, "", window.location.pathname + "?tab=accounts");
    } else if (linkToken) {
      validateLinkToken(linkToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateLinkToken = async (token: string) => {
    try {
      const res = await fetch("/api/user/accounts/validate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        setSuccess(t("profile.accounts.unlink_success"));
        fetchAccounts();
      } else {
        const data = await res.json();
        setError(data.error || t("profile.accounts.error_link"));
      }
    } catch (_err) {
      setError(t("profile.accounts.error_link"));
    } finally {
      // clear the URL params
      window.history.replaceState({}, "", window.location.pathname + "?tab=accounts");
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/user/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
      } else {
        setError(t("profile.accounts.error_fetch"));
      }
    } catch (_err) {
      setError(t("profile.accounts.error_fetch"));
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProviders = async () => {
    try {
      const res = await fetch("/api/oauth-providers");
      if (res.ok) {
        const data = await res.json();
        setAvailableProviders(data.providers);
      }
    } catch (err) {
      console.error("Error fetching providers:", err);
    }
  };

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
    } catch (_err) {
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
        setAccounts(accounts.filter((a) => a.id !== accountToDelete.id));
        setSuccess(t("profile.accounts.unlink_success"));
        setDeleteDialogOpen(false);
      } else {
        const data = await res.json();
        setError(data.error || t("profile.accounts.error_unlink"));
      }
    } catch (_err) {
      setError(t("profile.accounts.error_unlink"));
    } finally {
      setDeleting(false);
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

  if (loading) {
    return (
      <div className="modern-card p-6">
        <div className="flex justify-center items-center py-8">
          <svg className="animate-spin h-12 w-12 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="modern-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-xl border border-[var(--primary-dark)]/50 flex items-center justify-center modern-icon-blue">
            <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">{t("profile.accounts.title")}</h2>
            <p className="text-sm text-[var(--foreground-muted)]">{t("profile.accounts.description")}</p>
          </div>
        </div>

        {error && (
          <div className="modern-alert modern-alert-error mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-sm hover:opacity-70">✕</button>
            </div>
          </div>
        )}

        {success && (
          <div className="modern-alert modern-alert-success mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm">{success}</p>
              </div>
              <button onClick={() => setSuccess(null)} className="text-sm hover:opacity-70">✕</button>
            </div>
          </div>
        )}

        {/* Accounts */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-3">{t("profile.accounts.connected")}</h3>
          {accounts.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">{t("profile.accounts.no_connected")}</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border border-[var(--border)] rounded-xl bg-[var(--surface)]/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[var(--primary)]">
                      {providerIcons[account.provider] || (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{getProviderDisplayName(account.provider)}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">{account.providerAccountId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteClick(account)}
                    className="p-2 hover:bg-red-900/30 hover:text-red-400 text-[var(--foreground-muted)] rounded-lg transition-colors"
                    aria-label={t("profile.accounts.unlink")}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Providers */}
        <div className="border-t border-[var(--border)] pt-6">
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-3">{t("profile.accounts.available")}</h3>
          <div className="flex flex-wrap gap-2">
            {availableProviders.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleLinkAccount(provider.name)}
                disabled={isProviderLinked(provider.name)}
                className="modern-button modern-button-secondary flex items-center gap-2 disabled:opacity-50"
              >
                <span className="text-[var(--primary)]">
                  {providerIcons[provider.name] || (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                </span>
                {provider.displayName || provider.name}
                {isProviderLinked(provider.name) && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-900/30 border border-green-700/50 text-green-400">
                    {t("profile.accounts.linked")}
                  </span>
                )}
              </button>
            ))}
            {availableProviders.length === 0 && (
              <p className="text-sm text-[var(--foreground-muted)]">{t("profile.accounts.no_available")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Unlink confirmation dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setDeleteDialogOpen(false)}>
          <div className="modern-card p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[var(--foreground)] mb-3">{t("profile.accounts.confirm_unlink")}</h3>
            <p className="text-[var(--foreground-muted)] mb-6">
              {t("profile.accounts.confirm_unlink_message", {
                provider: accountToDelete ? getProviderDisplayName(accountToDelete.provider) : "",
              })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
                className="modern-button modern-button-secondary flex-1"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="modern-button flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                {deleting ? (
                  <svg className="animate-spin h-5 w-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  t("profile.accounts.unlink")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
