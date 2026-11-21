"use client";

import Navigation from "@/components/Navigation";
import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ProfileInfo from "@/components/profile/ProfileInfo";
import SharesList from "@/components/profile/SharesList";
import ProfileStats from "@/components/profile/ProfileStats";
import ConnectedAccounts from "@/components/profile/ConnectedAccounts";
import type { UserShare, UserShareUpdate } from "@/components/profile/types";
import ApiKeysSection from "@/components/ApiKeysSection";
import TwoFactorSection from "@/components/profile/TwoFactorSection";
import AccessLogs from "@/components/profile/AccessLogs";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/Toast";
import { Tabs, Tab } from "@/components/ui";
import WaveSkeleton from "@/components/ui/WaveSkeleton";

type User = {
  id: string;
  name?: string;
  email: string;
  createdAt: string;
};

type TabKey = "profile" | "shares" | "accounts" | "apikeys" | "accesslogs";

/** ARIA wiring between a tab (rendered by <Tab>) and its panel. */
const panelProps = (key: TabKey) => ({
  role: "tabpanel" as const,
  id: `tabpanel-${key}`,
  "aria-labelledby": `tab-${key}`,
});

const ProfilePage = () => {
  const { t } = useTranslation();
  const { status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shares, setShares] = useState<UserShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  const fetchUserData = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  }, []);

  const fetchShares = useCallback(async () => {
    try {
      const res = await fetch("/api/user/shares");
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares);
      }
    } catch (error) {
      console.error("Error fetching shares:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchUserData();
      fetchShares();
    }
  }, [status, fetchUserData, fetchShares]);

  const handleDeleteShare = async (id: string) => {
    const index = shares.findIndex((s) => s.id === id);
    const removed = shares[index];
    if (!removed) return;
    setShares((current) => current.filter((s) => s.id !== id));

    // Put the share back where it was when the server refuses or the request fails
    const rollback = () =>
      setShares((current) => {
        if (current.some((s) => s.id === id)) return current;
        const next = [...current];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });

    try {
      const res = await fetch(`/api/user/shares/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        rollback();
        toast.error(data.error || t("profile.error_delete"));
      }
    } catch (error) {
      console.error("Error deleting share:", error);
      rollback();
      toast.error(t("profile.error_delete"));
    }
  };

  const handleUpdateShare = async (id: string, updateData: UserShareUpdate) => {
    try {
      const res = await fetch(`/api/user/shares/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        const data = await res.json();
        setShares((current) => current.map((s) => (s.id === id ? data.share : s)));
      } else {
        const data = await res.json();
        toast.error(data.error || t("profile.error_update_share"));
      }
    } catch (error) {
      console.error("Error updating share:", error);
      toast.error(t("profile.error_update_share"));
    }
  };

  // Also covers the moment before the guard redirects an unauthenticated visitor
  if (status !== "authenticated" || loading || !user) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--background)]">
        <Navigation />
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-10" aria-busy="true">
          <p role="status" className="sr-only">
            {t("profile.loading")}
          </p>
          <div className="flex gap-2 mb-8">
            {[88, 72, 120, 104].map((width) => (
              <WaveSkeleton key={width} variant="rounded" width={width} height={36} />
            ))}
          </div>
          <WaveSkeleton variant="rounded" height={320} sx={{ borderRadius: "var(--radius-lg)" }} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navigation />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="sr-only">{t("profile.title", "My Profile")}</h1>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabKey)}
          className="mb-8"
        >
          <Tab value="profile">{t("profile.tab_profile", "Profile")}</Tab>
          <Tab value="shares">{t("profile.tab_shares", "Shares")}</Tab>
          <Tab value="accounts">{t("profile.tab_accounts", "Linked accounts")}</Tab>
          <Tab value="apikeys">{t("profile.tab_apikeys", "API Keys")}</Tab>
          <Tab value="accesslogs">{t("profile.tab_accesslogs", "Access Logs")}</Tab>
        </Tabs>

        {activeTab === "profile" && (
          <div {...panelProps("profile")}>
            <ProfileInfo user={user} onUpdate={setUser} />
            <TwoFactorSection />
          </div>
        )}

        {activeTab === "shares" && (
          <div {...panelProps("shares")}>
            <ProfileStats shares={shares} />
            <SharesList shares={shares} onDelete={handleDeleteShare} onUpdate={handleUpdateShare} />
          </div>
        )}

        {activeTab === "accounts" && (
          <div {...panelProps("accounts")}>
            <ConnectedAccounts />
          </div>
        )}

        {activeTab === "apikeys" && (
          <div {...panelProps("apikeys")}>
            <ApiKeysSection />
          </div>
        )}

        {activeTab === "accesslogs" && (
          <div {...panelProps("accesslogs")}>
            <AccessLogs />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ProfilePage;
