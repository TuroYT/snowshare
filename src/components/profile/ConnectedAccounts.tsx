"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
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
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t("profile.accounts.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t("profile.accounts.description")}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* Accounts */}
          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              {t("profile.accounts.connected")}
            </Typography>
            {accounts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("profile.accounts.no_connected")}
              </Typography>
            ) : (
              <Box display="flex" flexDirection="column" gap={1}>
                {accounts.map((account) => (
                  <Box
                    key={account.id}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    p={2}
                    border={1}
                    borderColor="divider"
                    borderRadius={1}
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      {providerIcons[account.provider] || <LinkIcon />}
                      <Box>
                        <Typography variant="body1">{getProviderDisplayName(account.provider)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {account.providerAccountId}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(account)}
                      aria-label={t("profile.accounts.unlink")}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* Providers */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t("profile.accounts.available")}
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {availableProviders.map((provider) => (
                <Button
                  key={provider.id}
                  variant="outlined"
                  startIcon={providerIcons[provider.name] || <LinkIcon />}
                  onClick={() => handleLinkAccount(provider.name)}
                  disabled={isProviderLinked(provider.name)}
                >
                  {provider.displayName || provider.name}
                  {isProviderLinked(provider.name) && (
                    <Chip label={t("profile.accounts.linked")} size="small" color="success" sx={{ ml: 1 }} />
                  )}
                </Button>
              ))}
              {availableProviders.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  {t("profile.accounts.no_available")}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Unlink confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t("profile.accounts.confirm_unlink")}</DialogTitle>
        <DialogContent>
          <Typography>
            {t("profile.accounts.confirm_unlink_message", {
              provider: accountToDelete ? getProviderDisplayName(accountToDelete.provider) : "",
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : t("profile.accounts.unlink")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
