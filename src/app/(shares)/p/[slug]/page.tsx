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
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";

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
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : "";
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
        console.error("Erreur réseau:", err);
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
      const html = Prism.highlight(pasteData.paste, Prism.languages[lang] || Prism.languages.plaintext, lang);
      setHighlighted(html);
    }
  }, [pasteData]);

  return (
    <div
      className="max-w-7xl mx-auto py-12 px-4"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--primary)" }}>{t("paste_view.title")}</h1>
      
      {loading && (
        <div className="text-center py-8">
          <div className="text-sm" style={{ color: "var(--primary)" }}>{t("paste_view.loading")}</div>
        </div>
      )}
      
      {error && !loading && (
        <div className="text-sm mb-4 p-4 rounded" style={{ color: "var(--destructive)", background: "var(--muted)" }}>
          {error}
        </div>
      )}

      {requiresPassword && !loading && (
        <ProtectedForm slug={slug} onSuccess={handlePasswordSuccess} />
      )}

      {pasteData && !loading && (
        <div
          className="rounded-xl p-6 border mt-6 relative"
          style={{ background: "var(--muted)", borderColor: "var(--border)" }}
        >
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--primary)" }}>{t("paste_view.content_title")}</h2>
          <button
            onClick={handleCopy}
            title={t("paste_view.copy")}
            className="absolute top-6 right-6 flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--input)] transition-colors"
            style={{ 
              background: copied ? "var(--primary)" : "var(--input)", 
              color: copied ? "var(--primary-foreground)" : "var(--foreground)", 
              border: "none" 
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="6" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="2" y="2" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
            </svg>
            <span className="text-xs">{copied ? t("paste_view.copied") : t("paste_view.copy")}</span>
          </button>
          
          {pasteData.language?.toLowerCase() === "markdown" ? (
            <div 
              className="rounded p-4 text-sm overflow-x-auto prose max-w-none"
              style={{ background: "var(--input)", color: "var(--foreground)" }}
            >
              <ReactMarkdown>{pasteData.paste}</ReactMarkdown>
            </div>
          ) : (
            <pre
              className={`rounded p-4 text-sm overflow-x-auto whitespace-pre-wrap language-${pasteData.language?.toLowerCase()}`}
              style={{ background: "var(--input)", color: "var(--foreground)" }}
              dangerouslySetInnerHTML={{ __html: highlighted || pasteData.paste }}
            />
          )}
          
          <div className="mt-2 text-xs flex justify-between items-center" style={{ color: "var(--muted-foreground)" }}>
            <span>{t("paste_view.language")} : {pasteData.language || t("paste_view.plain_text")}</span>
            <span>{t("paste_view.created_on")} : {new Date(pasteData.createdAt).toLocaleDateString()}</span>
          </div>
          
          {pasteData.expiresAt && (
            <div className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {t("paste_view.expires_on")} : {new Date(pasteData.expiresAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PasteViewPage;

const ProtectedForm: React.FC<{ slug: string; onSuccess: (data: PasteData) => void }> = ({ slug, onSuccess }) => {
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
      console.error("Erreur lors de la vérification du mot de passe:", err);
      setError(t("paste_view.connection_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-xl p-6 border"
      style={{ background: "var(--muted)", borderColor: "var(--border)" }}
    >
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--primary)" }}>
        {t("paste_view.protected_title")}
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
        {t("paste_view.protected_description")}
      </p>
      
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
            {t("paste_view.password_label")}
          </label>
          <input
            className="w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-colors"
            style={{ 
              background: "var(--input)", 
              color: "var(--foreground)", 
              borderColor: error ? "var(--destructive)" : "var(--border)" 
            }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("paste_view.password_placeholder")}
            required
            disabled={loading}
          />
        </div>
        
        {error && (
          <div 
            className="text-sm p-3 rounded" 
            style={{ 
              color: "var(--destructive)", 
              background: "rgba(220, 38, 38, 0.1)",
              border: "1px solid var(--destructive)"
            }}
          >
            {error}
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 rounded font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            disabled={loading || !password}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                  </circle>
                </svg>
                {t("paste_view.verifying")}
              </span>
            ) : (
              t("paste_view.access_paste")
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
