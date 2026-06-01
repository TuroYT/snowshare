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
  const [pasteInitialCode, setPasteInitialCode] = useState<string | undefined>(undefined);
  const [fileInitialFiles, setFileInitialFiles] = useState<File[] | undefined>(undefined);
  const { t } = useTranslation();
  const { branding } = useTheme();
  const { status } = useSession();

  useEffect(() => {
    const saved = localStorage.getItem("defaultTab");
    if (saved) setActiveTab(saved);
  }, []);

  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (el as HTMLElement).isContentEditable
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+1/2/3 → switch tabs
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === "1") {
          e.preventDefault();
          setActiveTab("linkshare");
          return;
        }
        if (e.key === "2") {
          e.preventDefault();
          setActiveTab("pasteshare");
          return;
        }
        if (e.key === "3") {
          e.preventDefault();
          setActiveTab("fileshare");
          return;
        }
      }
    };

    // Ctrl+V (or Cmd+V) → the browser fires a "paste" event carrying the
    // clipboard contents. Files go to FileShare, plain text to PasteShare.
    const handlePaste = (e: ClipboardEvent) => {
      const clipboard = e.clipboardData;
      if (!clipboard) return;

      // Files take priority — pasting an image/file into a text field is a no-op
      // anyway, so we hijack it regardless of what is focused.
      const files = Array.from(clipboard.files);
      if (files.length > 0) {
        e.preventDefault();
        setFileInitialFiles(files);
        setActiveTab("fileshare");
        return;
      }

      // Plain text → PasteShare, but only when not editing an input/textarea so
      // normal pasting into form fields keeps working.
      if (isInputFocused()) return;
      const text = clipboard.getData("text");
      if (!text.trim()) return;
      e.preventDefault();
      setPasteInitialCode(text);
      setActiveTab("pasteshare");
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("paste", handlePaste);
    };
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
          {activeTab === "pasteshare" && (
            <PasteShare
              initialCode={pasteInitialCode}
              onInitialCodeConsumed={() => setPasteInitialCode(undefined)}
            />
          )}
          {activeTab === "fileshare" && (
            <FileShare
              initialFiles={fileInitialFiles}
              onInitialFilesConsumed={() => setFileInitialFiles(undefined)}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
