"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import dynamic from "next/dynamic";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import WaveSkeleton from "@/components/ui/WaveSkeleton";
import { Spinner, Tabs, Tab } from "@/components/ui";
import UpdateNotification, { VersionInfo } from "@/components/admin/UpdateNotification";

type AdminTab = "users" | "settings" | "branding" | "logs" | "oauth" | "email";

const TAB_KEYS: readonly AdminTab[] = ["users", "settings", "branding", "oauth", "email", "logs"];

const TabLoadingFallback = () => (
  <div className="space-y-4 w-full">
    <WaveSkeleton variant="text" width={200} height={28} />
    <WaveSkeleton variant="rounded" height={120} />
    <WaveSkeleton variant="rounded" height={120} />
  </div>
);

const UsersTab = dynamic(() => import("@/components/admin/UsersTab"), {
  loading: TabLoadingFallback,
});
const SettingsTab = dynamic(() => import("@/components/admin/SettingsTab"), {
  loading: TabLoadingFallback,
});
const LogsTab = dynamic(() => import("@/components/admin/LogsTab"), {
  loading: TabLoadingFallback,
});
const BrandingTab = dynamic(() => import("@/components/admin/BrandingTab"), {
  loading: TabLoadingFallback,
});
const OAuthProvidersTab = dynamic(() => import("@/components/admin/OAuthProvidersTab"), {
  loading: TabLoadingFallback,
});
const EmailTemplatesTab = dynamic(() => import("@/components/admin/EmailTemplatesTab"), {
  loading: TabLoadingFallback,
});

export default function AdminPage() {
  const { status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("users");

  const checkAdminStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }
      const data = await response.json();
      if (data.user.isAdmin) {
        setIsAdmin(true);
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated") {
      checkAdminStatus();
    }
  }, [status, router, checkAdminStatus]);

  if (loading) {
    return (
      <div className="min-h-screen text-[var(--foreground)] flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Spinner className="w-10 h-10 mx-auto" />
            <p className="mt-4 text-[var(--foreground-muted)]">{t("admin.loading")}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen text-[var(--foreground)] flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="inline-block rounded-full p-3 bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] border border-[color-mix(in_srgb,var(--destructive)_25%,transparent)] mb-4">
              <svg
                className="w-12 h-12 text-[var(--destructive-text)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold mb-2">{t("admin.error_access_denied")}</h1>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[var(--foreground)] flex flex-col">
      <Navigation />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
              {t("admin.title")} - v{versionInfo?.currentVersion ?? t("admin.version_loading")}
            </h1>
            <p className="text-[var(--foreground-muted)]">{t("admin.subtitle")}</p>
          </div>

          {/* Update Notification */}
          <UpdateNotification versionInfo={versionInfo} setVersionInfo={setVersionInfo} />

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as AdminTab)}
            className="mb-6"
          >
            {TAB_KEYS.map((tab) => (
              <Tab key={tab} value={tab}>
                {tab === "oauth" ? "OAuth / SSO" : t(`admin.tabs.${tab}`)}
              </Tab>
            ))}
          </Tabs>

          {/* Tab Content */}
          <div
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6"
          >
            {activeTab === "users" && <UsersTab />}
            {activeTab === "settings" && <SettingsTab />}
            {activeTab === "branding" && <BrandingTab />}
            {activeTab === "oauth" && <OAuthProvidersTab />}
            {activeTab === "email" && <EmailTemplatesTab />}
            {activeTab === "logs" && <LogsTab />}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
