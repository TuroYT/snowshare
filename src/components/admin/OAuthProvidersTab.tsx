"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import WaveSkeleton from "@/components/ui/WaveSkeleton";
import SkeletonTransition from "@/components/ui/SkeletonTransition";
import { availableProviders } from "@/lib/providers";
import Link from "next/link";
import { Badge, Button, Input, Modal, toast } from "@/components/ui";

interface OAuthProvider {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
  clientId: string | null;
  issuer: string | null;
  tenantId: string | null;
  updatedAt: string;
}

const CALLBACK_PATH = "/api/auth/callback/";

export default function OAuthProvidersTab() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    clientId: "",
    clientSecret: "",
    issuer: "",
    tenantId: "",
    enabled: false,
  });
  const [origin, setOrigin] = useState("");

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/admin/oauth-providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers);
      }
    } catch (error) {
      console.error("Failed to fetch providers", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
    setOrigin(window.location.origin);
  }, []);

  const handleEdit = (providerName: string) => {
    const provider = providers.find((p) => p.name === providerName);
    if (provider) {
      setFormData({
        name: provider.name,
        displayName: provider.displayName,
        clientId: provider.clientId || "",
        clientSecret: "", // the stored secret is never sent to the client
        issuer: provider.issuer || "",
        tenantId: provider.tenantId || "",
        enabled: provider.enabled,
      });
    } else {
      const defaultName =
        availableProviders.find((p) => p.id === providerName)?.name || providerName;
      setFormData({
        name: providerName,
        displayName: defaultName,
        clientId: "",
        clientSecret: "",
        issuer: "",
        tenantId: "",
        enabled: false,
      });
    }
    setEditingProvider(providerName);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/oauth-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await fetchProviders();
        setEditingProvider(null);
        toast.success(t("admin.save_success", "Changes saved successfully"));
      } else {
        toast.error(t("admin.save_error", "Error saving changes"));
      }
    } catch (error) {
      console.error("Failed to save provider", error);
      toast.error(t("admin.save_error", "Error saving changes"));
    } finally {
      setSaving(false);
    }
  };

  const skeleton = (
    <div className="space-y-4">
      <div>
        <WaveSkeleton variant="text" width={192} height={32} className="mb-2" />
        <WaveSkeleton variant="text" width={384} height={22} className="mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col p-4 rounded-[var(--radius-lg)] border border-[var(--border)]"
            >
              <div className="flex justify-between items-start mb-4">
                <WaveSkeleton variant="text" width={96} height={26} />
                <WaveSkeleton variant="rounded" width={64} height={24} className="rounded-full" />
              </div>
              <WaveSkeleton variant="text" width="80%" height={20} className="mb-4 flex-1" />
              <WaveSkeleton variant="rounded" height={38} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <SkeletonTransition loading={loading} skeleton={skeleton}>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">
            {t("admin.oauth.title", "Fournisseurs OAuth")}
          </h2>
          <p className="text-sm text-[var(--foreground-muted)] mb-6">
            {t(
              "admin.oauth.description",
              "Configure external authentication providers. You will need to create an OAuth application on the provider's developer console."
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableProviders.map((p) => {
              const configured = providers.find((cp) => cp.name === p.id);
              const isEnabled = configured?.enabled;

              return (
                <div
                  key={p.id}
                  className={`flex flex-col p-4 rounded-[var(--radius-lg)] border transition-colors duration-100 ${
                    isEnabled
                      ? "border-[color-mix(in_srgb,var(--success)_40%,transparent)] bg-[color-mix(in_srgb,var(--success)_5%,transparent)]"
                      : "border-[var(--border)] bg-[var(--background)]"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <span className="min-w-0 break-words font-semibold text-[var(--foreground)]">
                      {p.name}
                    </span>
                    <Badge variant={isEnabled ? "success" : "muted"} className="shrink-0">
                      {isEnabled
                        ? t("admin.oauth.enabled", "Enabled")
                        : t("admin.oauth.disabled", "Disabled")}
                    </Badge>
                  </div>

                  <p className="text-sm text-[var(--foreground-muted)] mb-4 flex-1">
                    {configured
                      ? `${t("admin.oauth.client_id", "Client ID")}: ${configured.clientId?.substring(0, 8)}...`
                      : t("admin.oauth.not_configured", "Not configured")}
                  </p>

                  <Button type="button" className="w-full" onClick={() => handleEdit(p.id)}>
                    {configured
                      ? t("admin.oauth.edit", "Configurer")
                      : t("admin.oauth.setup", "Installer")}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <Modal
          isOpen={editingProvider !== null}
          onClose={() => {
            if (!saving) setEditingProvider(null);
          }}
          title={t("admin.oauth.configure_provider", "Configurer {{provider}}", {
            provider: availableProviders.find((p) => p.id === editingProvider)?.name,
          })}
          size="sm"
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-hover)] border border-[var(--border)] text-sm">
              <p className="font-semibold text-[var(--foreground)] mb-1 uppercase text-xs tracking-wide">
                {t("admin.oauth.callback_url", "URL de Callback (Redirect URI)")}
              </p>
              <code className="block p-2 rounded-[var(--radius)] bg-[var(--surface)] border border-[var(--border)] font-mono text-xs text-[var(--foreground)] break-all select-all">
                {origin}
                {CALLBACK_PATH}
                {editingProvider}
              </code>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {t(
                  "admin.oauth.callback_help",
                  "Copy this URL into your OAuth provider's settings."
                )}
              </p>
            </div>

            <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-hover)] border border-[var(--border)] text-sm">
              <p className="font-semibold text-[var(--foreground)] mb-1 uppercase text-xs tracking-wide">
                {t("admin.oauth.documentation", "Documentation du fournisseur")}
              </p>
              <Link
                href={
                  availableProviders.find((p) => p.id === editingProvider)?.documentationUrl || "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--foreground)] underline underline-offset-2 decoration-[var(--primary)] hover:decoration-2 break-all text-xs rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                {availableProviders.find((p) => p.id === editingProvider)?.documentationUrl}
              </Link>
            </div>

            {editingProvider === "oidc" && (
              <Input
                label={t("admin.oauth.issuer", "Issuer URL (OpenID Connect)")}
                type="url"
                value={formData.issuer}
                onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                required
                placeholder="https://auth.example.com/realms/myrealm"
                helperText={t(
                  "admin.oauth.issuer_help",
                  "L'URL de base de votre fournisseur OpenID Connect"
                )}
              />
            )}

            {editingProvider === "azure-ad" && (
              <Input
                label={t("admin.oauth.tenant_id", "Tenant ID")}
                type="text"
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                required
                helperText={t(
                  "admin.oauth.tenant_id_help",
                  "L'identifiant de votre locataire Azure AD (Tenant ID)"
                )}
              />
            )}

            <Input
              label={t("admin.oauth.client_id_field", "Client ID")}
              type="text"
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              required
            />

            <Input
              label={t("admin.oauth.client_secret", "Client Secret")}
              type="password"
              value={formData.clientSecret}
              onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
              placeholder={
                providers.find((p) => p.name === editingProvider)?.clientId
                  ? t("admin.oauth.secret_placeholder", "(Leave empty to keep unchanged)")
                  : ""
              }
              helperText={t(
                "admin.oauth.secret_help",
                "The secret is encrypted before being stored."
              )}
            />

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 shrink-0 rounded accent-[var(--primary)]"
              />
              <span className="text-sm text-[var(--foreground)]">
                {t("admin.oauth.enable_provider", "Activer ce fournisseur")}
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingProvider(null)}
                disabled={saving}
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" isLoading={saving}>
                {t("common.save", "Save")}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </SkeletonTransition>
  );
}
