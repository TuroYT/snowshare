"use client";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, Tab } from "@/components/ui";
import LinkShare from "@/components/LinkShare";
import PasteShare from "@/components/PasteShare";
import FileShare from "@/components/FileShare";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("linkshare");
  const { t } = useTranslation();
  const { branding } = useTheme();
  const { status } = useSession();

  useEffect(() => {
    const saved = localStorage.getItem("defaultTab");
    if (saved) setActiveTab(saved);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.defaultTab) {
          setActiveTab(d.user.defaultTab);
          localStorage.setItem("defaultTab", d.user.defaultTab);
        } else {
          localStorage.removeItem("defaultTab");
        }
      })
      .catch(() => {});
  }, [status]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navigation />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Hero */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">
            {t("home.eyebrow", "Secure sharing")}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--foreground)] mb-3">
            {branding.appName}
          </h1>
          <p className="text-[var(--foreground-muted)] max-w-lg">{branding.appDescription}</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <Tab value="linkshare">{t("tabs.linkshare", "Link")}</Tab>
          <Tab value="pasteshare">{t("tabs.pasteshare", "Text")}</Tab>
          <Tab value="fileshare">{t("tabs.fileshare", "File")}</Tab>
        </Tabs>

        {/* Content */}
        <div key={activeTab} className="animate-fade-in-up">
          {activeTab === "linkshare" && <LinkShare />}
          {activeTab === "pasteshare" && <PasteShare />}
          {activeTab === "fileshare" && <FileShare />}
        </div>
      </main>
      <Footer />
    </div>
  );
}
