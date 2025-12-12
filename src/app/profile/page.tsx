"use client";

import Navigation from "@/components/Navigation";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ProfileInfo from "@/components/profile/ProfileInfo";
import SharesList from "@/components/profile/SharesList";
import ProfileStats from "@/components/profile/ProfileStats";
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
  const [activeTab, setActiveTab] = useState<"profile" | "shares">("profile");

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
      <div className="min-h-screen bg-[var(--background)]">
        <Navigation />
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <svg
              className="animate-spin h-12 w-12 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
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
    <div className="min-h-screen bg-[var(--background)]">
      <Navigation />

      <main className="max-w-6xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold sm:text-6xl bg-clip-text text-transparent mb-4" style={{ backgroundImage: 'linear-gradient(to right, var(--primary), var(--secondary), var(--primary))' }}>
            {t("profile.title")}
          </h1>
          <p className="text-xl text-[var(--foreground)]">
            {t("profile.subtitle")}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <button
            onClick={() => setActiveTab("profile")}
            className={`modern-tab ${
              activeTab === "profile" ? "modern-tab-active" : "modern-tab-inactive"
            }`}
          >
            <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {t("profile.tab_info")}
          </button>
          <button
            onClick={() => setActiveTab("shares")}
            className={`modern-tab ${
              activeTab === "shares" ? "modern-tab-active" : "modern-tab-inactive"
            }`}
          >
            <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            {t("profile.tab_shares")} ({shares.length})
          </button>
        </div>

        {/* Content */}
        <div className="mt-8">
          {activeTab === "profile" && user && (
            <ProfileInfo user={user} onUpdate={setUser} />
          )}

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
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProfilePage;
