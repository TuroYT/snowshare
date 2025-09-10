"use client";

import React, { useEffect, useState } from "react";
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

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-100">Paste</h1>
      {loading && <div className="text-blue-300 text-sm">Chargement...</div>}
      {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
      {!paste && error && error === "Ce partage est protégé" && (
        <ProtectedForm slug={slug} onSuccess={(p, lang) => { setPaste(p); setLanguage(lang); setError(null); }} />
      )}

      {paste && (
        <div className="bg-[#181f2a] rounded-xl p-6 border border-[#232a38] mt-6">
          <h2 className="text-lg font-semibold mb-2 text-gray-100">Contenu du paste</h2>
          <pre className="bg-[#232a38] rounded p-4 text-sm text-gray-200 overflow-x-auto whitespace-pre-wrap">
            {paste}
          </pre>
          <div className="mt-2 text-xs text-gray-400">Langage : {language}</div>
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
    <form onSubmit={submit} className="space-y-4 bg-[#0b1220] p-4 rounded">
      <label className="block text-gray-300">Mot de passe</label>
      <input className="input-paste w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="flex justify-end">
        <button type="submit" className="btn-paste px-4 py-2" disabled={loading}>{loading ? "..." : "Voir"}</button>
      </div>
    </form>
  );
};
