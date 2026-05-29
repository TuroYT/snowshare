"use client";

import { useState, useEffect, useRef, useId } from "react";
import { useTranslation } from "react-i18next";
import WaveSkeleton from "@/components/ui/WaveSkeleton";
import SkeletonTransition from "@/components/ui/SkeletonTransition";
import { availableProviders } from "@/lib/providers";
import Link from "next/link";

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
  const dialogId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (!editingProvider) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const focusableSelectors =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingProvider(null);
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
        (el) => !el.hasAttribute("disabled")
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = dialog.querySelector<HTMLElement>(focusableSelectors);
      focusable?.focus();
    }

    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previousFocusRef.current?.focus();
    };
  }, [editingProvider]);

  const handleEdit = (providerName: string) => {
    const provider = providers.find((p) => p.name === providerName);
    if (provider) {
      setFormData({
        name: provider.name,
        displayName: provider.displayName,
        clientId: provider.clientId || "",
        clientSecret: "", // Never show secret
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
    try {
      const res = await fetch("/api/admin/oauth-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await fetchProviders();
        setEditingProvider(null);
      }
    } catch (error) {
      console.error("Failed to save provider", error);
    }
  };

  const skeleton = (
    <div className="space-y-4">
      <div className="p-6 bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--border)]">
        <WaveSkeleton variant="text" width={192} height={32} className="mb-2" />
        <WaveSkeleton variant="text" width={384} height={22} className="mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col p-4 rounded-[var(--radius)] border border-[var(--border)]"
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
        <div className="p-6 bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">
            {t("admin.oauth.title", "Fournisseurs OAuth")}
          </h2>
          <p className="text-sm text-[var(--foreground-muted)] mb-6">
            {t(
              "admin.oauth.description",
              "Configurez les fournisseurs d'authentification externes. Vous devrez créer une application OAuth sur la console développeur du fournisseur."
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableProviders.map((p) => {
              const configured = providers.find((cp) => cp.name === p.id);
              const isEnabled = configured?.enabled;

              return (
                <div
                  key={p.id}
                  className={`flex flex-col p-4 rounded-[var(--radius)] border transition-colors ${
                    isEnabled
                      ? "border-green-600/50 bg-green-600/5"
                      : "border-[var(--border)] bg-[var(--background)]"
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-semibold text-[var(--foreground)]">{p.name}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        isEnabled
                          ? "bg-green-600/20 text-green-400 border-green-600/40"
                          : "bg-[var(--surface-hover)] text-[var(--foreground-muted)] border-[var(--border)]"
                      }`}
                    >
                      {isEnabled
                        ? t("admin.oauth.enabled", "Activé")
                        : t("admin.oauth.disabled", "Désactivé")}
                    </span>
                  </div>

                  <p className="text-sm text-[var(--foreground-muted)] mb-4 flex-1">
                    {configured
                      ? `${t("admin.oauth.client_id", "Client ID")}: ${configured.clientId?.substring(0, 8)}...`
                      : t("admin.oauth.not_configured", "Non configuré")}
                  </p>

                  <button
                    onClick={() => handleEdit(p.id)}
                    className="w-full px-4 py-2 rounded-[var(--radius)] text-sm font-medium text-white transition-colors"
                    style={{ backgroundColor: "var(--primary)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--primary-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--primary)";
                    }}
                  >
                    {configured
                      ? t("admin.oauth.edit", "Configurer")
                      : t("admin.oauth.setup", "Installer")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit dialog */}
        {editingProvider && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingProvider(null);
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogId}
              className="relative w-full max-w-lg bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <h3 id={dialogId} className="font-semibold text-[var(--foreground)]">
                  {t("admin.oauth.configure_provider", "Configurer {{provider}}", {
                    provider: availableProviders.find((p) => p.id === editingProvider)?.name,
                  })}
                </h3>
                <button
                  onClick={() => setEditingProvider(null)}
                  className="p-1.5 rounded-full hover:bg-[var(--background)] transition-colors"
                  aria-label="Close"
                >
                  <svg
                    className="w-4 h-4 text-[var(--foreground-muted)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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

              <form onSubmit={handleSave}>
                <div className="px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Callback URL info */}
                  <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-hover)] border border-[var(--border)] text-sm">
                    <p className="font-semibold text-[var(--foreground)] mb-1 uppercase text-xs tracking-wide">
                      {t("admin.oauth.callback_url", "URL de Callback (Redirect URI)")}
                    </p>
                    <code className="block p-2 rounded bg-black/20 font-mono text-xs text-[var(--foreground)] break-all select-all">
                      {origin}
                      {CALLBACK_PATH}
                      {editingProvider}
                    </code>
                    <p className="text-xs text-[var(--foreground-muted)] mt-1">
                      {t(
                        "admin.oauth.callback_help",
                        "Copiez cette URL dans les paramètres de votre fournisseur OAuth."
                      )}
                    </p>
                  </div>

                  {/* Documentation link */}
                  <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-hover)] border border-[var(--border)] text-sm">
                    <p className="font-semibold text-[var(--foreground)] mb-1 uppercase text-xs tracking-wide">
                      {t("admin.oauth.documentation", "Documentation du fournisseur")}
                    </p>
                    <Link
                      href={
                        availableProviders.find((p) => p.id === editingProvider)
                          ?.documentationUrl || "#"
                      }
                      target="_BLANK"
                      rel="noopener noreferrer"
                      className="text-[var(--primary)] hover:underline break-all text-xs"
                    >
                      {availableProviders.find((p) => p.id === editingProvider)?.documentationUrl}
                    </Link>
                  </div>

                  {/* Fields */}
                  {editingProvider === "oidc" && (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-[var(--foreground)]">
                        {t("admin.oauth.issuer", "Issuer URL (OpenID Connect)")}
                      </label>
                      <input
                        type="url"
                        value={formData.issuer}
                        onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                        required
                        className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        placeholder="https://auth.example.com/realms/myrealm"
                      />
                      <p className="text-xs text-[var(--foreground-muted)]">
                        {t(
                          "admin.oauth.issuer_help",
                          "L'URL de base de votre fournisseur OpenID Connect"
                        )}
                      </p>
                    </div>
                  )}

                  {editingProvider === "azure-ad" && (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-[var(--foreground)]">
                        {t("admin.oauth.tenant_id", "Tenant ID")}
                      </label>
                      <input
                        type="text"
                        value={formData.tenantId}
                        onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                        required
                        className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                      <p className="text-xs text-[var(--foreground-muted)]">
                        {t(
                          "admin.oauth.tenant_id_help",
                          "L'identifiant de votre locataire Azure AD (Tenant ID)"
                        )}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-[var(--foreground)]">
                      {t("admin.oauth.client_id_field", "Client ID")}
                    </label>
                    <input
                      type="text"
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      required
                      className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-[var(--foreground)]">
                      {t("admin.oauth.client_secret", "Client Secret")}
                    </label>
                    <input
                      type="password"
                      value={formData.clientSecret}
                      onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                      className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      placeholder={
                        providers.find((p) => p.name === editingProvider)?.clientId
                          ? t(
                              "admin.oauth.secret_placeholder",
                              "(Laisser vide pour ne pas changer)"
                            )
                          : ""
                      }
                    />
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {t("admin.oauth.secret_help", "Le secret est chiffré avant d'être stocké.")}
                    </p>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="w-4 h-4 rounded accent-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--foreground)]">
                      {t("admin.oauth.enable_provider", "Activer ce fournisseur")}
                    </span>
                  </label>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setEditingProvider(null)}
                    className="px-4 py-2 rounded-[var(--radius)] text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    {t("common.cancel", "Annuler")}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-[var(--radius)] text-sm font-medium text-white transition-colors"
                    style={{ backgroundColor: "var(--primary)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--primary-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--primary)";
                    }}
                  >
                    {t("common.save", "Enregistrer")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SkeletonTransition>
  );
}
