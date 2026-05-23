"use client";

import React, { useEffect, useState } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-java";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-php";
import "prismjs/components/prism-css";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-powershell";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import Footer from "@/components/Footer";
import { Badge, Button, Input, Spinner } from "@/components/ui";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface PasteData {
  paste: string;
  language: string;
  slug: string;
  createdAt: string;
  expiresAt?: string;
  ownerId?: string;
}

interface ApiResponse {
  success?: boolean;
  data?: PasteData;
  error?: string;
  requiresPassword?: boolean;
}

const PasteViewPage = () => {
  const { t } = useTranslation();
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
        ? params.slug[0]
        : "";
  const [pasteData, setPasteData] = useState<PasteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresPassword, setRequiresPassword] = useState(false);

  useEffect(() => {
    if (!slug) return;

    const fetchPaste = async () => {
      setLoading(true);
      setError(null);
      setRequiresPassword(false);

      try {
        const res = await fetch(`/p/${slug}/api`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data: ApiResponse = await res.json();

        if (res.ok && data.success && data.data) {
          setPasteData(data.data);
        } else if (res.status === 403 && data.requiresPassword) {
          setRequiresPassword(true);
          setError(data.error || t("paste_view.password_protected_error"));
        } else {
          setError(data.error || t("paste_view.fetch_error"));
        }
      } catch (err) {
        console.error("Network error:", err);
        setError(t("paste_view.connection_error"));
      } finally {
        setLoading(false);
      }
    };

    fetchPaste();
  }, [slug, t]);

  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState("");

  const handleCopy = () => {
    if (pasteData?.paste) {
      navigator.clipboard.writeText(pasteData.paste);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handlePasswordSuccess = (data: PasteData) => {
    setPasteData(data);
    setRequiresPassword(false);
    setError(null);
  };

  useEffect(() => {
    if (pasteData?.paste && pasteData?.language) {
      // PrismJS language mapping
      let lang = pasteData.language.toLowerCase();
      if (lang === "js") lang = "javascript";
      if (lang === "ts") lang = "typescript";
      if (lang === "c++") lang = "cpp";
      if (lang === "html") lang = "markup";
      // Ensure the language exists, fallback to plaintext
      if (!Prism.languages[lang]) lang = "plaintext";
      const html = Prism.highlight(
        pasteData.paste,
        Prism.languages[lang] || Prism.languages.plaintext,
        lang
      );
      setHighlighted(html);
    }
  }, [pasteData]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-10">
        {/* Loading state */}
        {loading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {/* Error state (non-password) */}
        {error && !loading && !requiresPassword && (
          <div className="text-center py-12">
            <p className="text-[var(--foreground-muted)]">{error}</p>
          </div>
        )}

        {/* Password gate */}
        {requiresPassword && !loading && (
          <ProtectedForm slug={slug} onSuccess={handlePasswordSuccess} />
        )}

        {/* Content */}
        {pasteData && !loading && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-6 gap-4">
              <div>
                <Badge variant="muted" className="mb-2">
                  {t("paste_view.title")}
                </Badge>
                <h1 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">
                  {t("paste_view.content_title")}
                </h1>
              </div>
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? t("paste_view.copied") : t("paste_view.copy")}
              </Button>
            </div>

            {/* Viewer */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
              <div className="p-4">
                {pasteData.language?.toLowerCase() === "markdown" ? (
                  <div
                    className="rounded p-4 text-sm overflow-x-auto prose max-w-none"
                    style={{ background: "var(--input)", color: "var(--foreground)" }}
                  >
                    <ReactMarkdown>{pasteData.paste}</ReactMarkdown>
                  </div>
                ) : (
                  // Content from Prism.js is sanitized via escapeHtml before highlighting
                  <pre
                    className={`rounded p-4 text-sm overflow-x-auto whitespace-pre-wrap language-${pasteData.language?.toLowerCase()}`}
                    style={{ background: "var(--input)", color: "var(--foreground)" }}
                    dangerouslySetInnerHTML={{ __html: highlighted || escapeHtml(pasteData.paste) }}
                  />
                )}

                <div className="mt-2 text-xs flex justify-between items-center text-[var(--foreground-muted)]">
                  <span>
                    {t("paste_view.language")} : {pasteData.language || t("paste_view.plain_text")}
                  </span>
                  <span>
                    {t("paste_view.created_on")} :{" "}
                    {new Date(pasteData.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {pasteData.expiresAt && (
                  <div className="mt-1 text-xs text-[var(--foreground-muted)]">
                    {t("paste_view.expires_on")} :{" "}
                    {new Date(pasteData.expiresAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PasteViewPage;

const ProtectedForm: React.FC<{ slug: string; onSuccess: (data: PasteData) => void }> = ({
  slug,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/p/${slug}/api`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const response: ApiResponse = await res.json();

      if (res.ok && response.success && response.data) {
        onSuccess(response.data);
      } else {
        setError(response.error || t("paste_view.password_incorrect"));
      }
    } catch (err) {
      console.error("Error verifying password:", err);
      setError(t("paste_view.connection_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto mt-8">
      <Badge variant="muted" className="mb-4">
        {t("paste_view.title")}
      </Badge>
      <h1 className="text-xl font-semibold text-[var(--foreground)] mb-6 tracking-tight">
        {t("paste_view.protected_title")}
      </h1>
      <form
        onSubmit={submit}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 space-y-4"
      >
        <p className="text-sm text-[var(--foreground-muted)]">
          {t("paste_view.protected_description")}
        </p>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          label={t("paste_view.password_label")}
          placeholder={t("paste_view.password_placeholder")}
          error={error || undefined}
          required
          disabled={loading}
        />
        <Button type="submit" isLoading={loading} disabled={!password} className="w-full">
          {t("paste_view.access_paste")}
        </Button>
      </form>
    </div>
  );
};
