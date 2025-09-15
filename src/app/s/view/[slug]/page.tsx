"use client";

import React, { useEffect, useState } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-java";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import { useParams } from "next/navigation";

const PasteViewPage = () => {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : Array.isArray(params.slug) ? params.slug[0] : "";
  const [paste, setPaste] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const fetchPaste = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/s/${slug}`);
        // If the route redirected (protected), the GET will return a redirect response.
        // We detect protected by response status 302.
        if (res.status === 302) {
          // redirect to same view page but with protected flag
          window.location.href = `/s/view/${slug}`;
          return;
        }
        const data = await res.json();
        if (!res.ok || data?.error) {
          // if protected, backend currently redirects — but if it returns JSON with message, handle it
          setError(data?.error || "Erreur lors de la récupération du paste");
        } else if (data.paste) {
          setPaste(data.paste);
          setLanguage(data.pastelanguage);
        } else {
          setError("Paste introuvable ou type non géré");
        }
      } catch {
        setError("Erreur réseau");
      } finally {
        setLoading(false);
      }
    };
    fetchPaste();
  }, [slug]);

  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState("");
  const handleCopy = () => {
    if (paste) {
      navigator.clipboard.writeText(paste);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  useEffect(() => {
    if (paste && language) {
      // PrismJS language mapping
      let lang = language.toLowerCase();
      if (lang === "js") lang = "javascript";
      if (lang === "ts") lang = "typescript";
      if (lang === "c++") lang = "cpp";
      if (lang === "html") lang = "markup";
      if (!Prism.languages[lang]) lang = "plaintext";
      const html = Prism.highlight(paste, Prism.languages[lang] || Prism.languages.plaintext, lang);
      setHighlighted(html);
    }
  }, [paste, language]);

  return (
    <div
      className="max-w-2xl mx-auto py-12 px-4"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--primary)" }}>Paste</h1>
      {loading && <div className="text-sm" style={{ color: "var(--primary)" }}>Chargement...</div>}
      {error && <div className="text-sm mb-4" style={{ color: "var(--destructive)" }}>{error}</div>}
      {!paste && error && error === "Ce partage est protégé" && (
        <ProtectedForm slug={slug} onSuccess={(p, lang) => { setPaste(p); setLanguage(lang); setError(null); }} />
      )}

      {paste && (
        <div
          className="rounded-xl p-6 border mt-6 relative"
          style={{ background: "var(--muted)", borderColor: "var(--border)" }}
        >
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--primary)" }}>Contenu du paste</h2>
          <button
            onClick={handleCopy}
            title="Copier"
            className="absolute top-6 right-6 flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--input)]"
            style={{ background: copied ? "var(--primary)" : "var(--input)", color: copied ? "var(--primary-foreground)" : "var(--foreground)", border: "none" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="6" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="2" y="2" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
            </svg>
            <span className="text-xs">{copied ? "Copié !" : "Copier"}</span>
          </button>
          <pre
            className={`rounded p-4 text-sm overflow-x-auto whitespace-pre-wrap language-${language?.toLowerCase()}`}
            style={{ background: "var(--input)", color: "var(--foreground)" }}
            dangerouslySetInnerHTML={{ __html: highlighted || paste }}
          />
          <div className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>Langage : {language}</div>
        </div>
      )}
    </div>
  );
};

export default PasteViewPage;

const ProtectedForm: React.FC<{ slug: string; onSuccess: (paste: string, lang: string | null) => void }> = ({ slug, onSuccess }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/s/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, password }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setError(data?.error || "Mot de passe incorrect");
      } else if (data.paste) {
        onSuccess(data.paste, data.pastelanguage || null);
      } else {
        setError("Paste introuvable");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 p-4 rounded"
      style={{ background: "var(--muted)" }}
    >
      <label className="block" style={{ color: "var(--foreground)" }}>Mot de passe</label>
      <input
        className="w-full px-3 py-2 rounded border focus:outline-none"
        style={{ background: "var(--input)", color: "var(--foreground)", borderColor: "var(--border)" }}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <div className="text-sm" style={{ color: "var(--destructive)" }}>{error}</div>}
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 rounded font-semibold"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          disabled={loading}
        >
          {loading ? "..." : "Voir"}
        </button>
      </div>
    </form>
  );
};
