"use client";

import Navigation from "@/components/Navigation";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ProfileInfo from "@/components/profile/ProfileInfo";
import SharesList from "@/components/profile/SharesList";
import ProfileStats from "@/components/profile/ProfileStats";
import ConnectedAccounts from "@/components/profile/ConnectedAccounts";
import ApiKeysSection from "@/components/ApiKeysSection";
import AccessLogs from "@/components/profile/AccessLogs";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";

type Share = {
  id: string;
  type: "FILE" | "PASTE" | "URL";
  slug: string;
  filePath?: string;
  paste?: string;
  pastelanguage?: string;
  urlOriginal?: string;
  password?: string;
  createdAt: string;
  expiresAt?: string;
  maxViews?: number | null;
  viewCount: number;
  accessCount?: number;
};

type User = {
  id: string;
  name?: string;
  email: string;
  createdAt: string;
};

const ProfilePage = () => {
  const { t } = useTranslation();
  const { status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "profile" | "shares" | "accounts" | "apikeys" | "accesslogs"
  >("profile");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchUserData();
      fetchShares();
    }
  }, [status]);

  const fetchUserData = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const fetchShares = async () => {
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
  };

  const handleDeleteShare = async (id: string) => {
    try {
      const res = await fetch(`/api/user/shares/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setShares(shares.filter((s) => s.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || t("profile.error_delete"));
      }
    } catch {
      alert(t("profile.error_delete"));
    }
  };

  const handleUpdateShare = async (id: string, updateData: Partial<Share>) => {
    try {
      const res = await fetch(`/api/user/shares/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        const data = await res.json();
        setShares(shares.map((s) => (s.id === id ? data.share : s)));
      } else {
        const data = await res.json();
        alert(data.error || t("profile.error_update_share"));
      }
    } catch {
      alert(t("profile.error_update_share"));
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <svg
              className="animate-spin h-12 w-12 text-[var(--primary)]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-[var(--foreground)]">{t("profile.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navigation />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Tab navigation */}
        <div className="mb-8 border-b border-[var(--border)]">
          <nav className="flex gap-0 -mb-px overflow-x-auto scrollbar-hide">
            {[
              { key: "profile", label: t("profile.tab_profile", "Profile") },
              { key: "shares", label: t("profile.tab_shares", "Shares") },
              { key: "accounts", label: t("profile.tab_accounts", "Linked accounts") },
              { key: "apikeys", label: t("profile.tab_apikeys", "API Keys") },
              { key: "accesslogs", label: t("profile.tab_accesslogs", "Access Logs") },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={[
                  "px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap shrink-0",
                  activeTab === key
                    ? "border-[var(--primary)] text-[var(--foreground)] font-medium"
                    : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div>
          {activeTab === "profile" && user && <ProfileInfo user={user} onUpdate={setUser} />}

          {activeTab === "shares" && (
            <>
              <ProfileStats shares={shares} />
              <SharesList
                shares={shares}
                onDelete={handleDeleteShare}
                onUpdate={handleUpdateShare}
              />
            </>
          )}

          {activeTab === "accounts" && <ConnectedAccounts />}

          {activeTab === "apikeys" && <ApiKeysSection />}

          {activeTab === "accesslogs" && <AccessLogs />}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProfilePage;
