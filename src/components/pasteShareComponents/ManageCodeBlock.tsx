"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { QRCodeSVG } from "qrcode.react";

const MAX_DAYS_ANON = 7;
const MAX_DAYS_AUTH = 365;

const LANGUAGES = [
  { value: "plaintext", label: "Plain" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "php", label: "PHP" },
  { value: "go", label: "Go" },
  { value: "powershell", label: "PowerShell" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" }
];

const ManageCodeBlock: React.FC<{
  code: string;
  onCodeChange?: (v: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
}> = ({ code, language, onLanguageChange }) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const [slug, setSlug] = React.useState("");
  const [expiresDays, setExpiresDays] = React.useState<number>(isAuthenticated ? 30 : MAX_DAYS_ANON);
  const [neverExpires, setNeverExpires] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [allowAnonPasteShare, setAllowAnonPasteShare] = React.useState<boolean | null>(null);
  const [settingsLoading, setSettingsLoading] = React.useState(true);

  // Fetch settings to check if anonymous paste sharing is allowed
  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setAllowAnonPasteShare(data.settings?.allowAnonPasteShare ?? true);
        } else {
          // Default to true if settings can't be fetched
          setAllowAnonPasteShare(true);
        }
      } catch {
        setAllowAnonPasteShare(true);
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const getDurationText = () => {
    const days = expiresDays;
    if (isAuthenticated && neverExpires) return t("linkshare.duration_never", "Ce paste n'expirera jamais");
    if (days === 1) return t("linkshare.duration_in_1_day", "Ce paste expirera dans 1 jour");
    if (days < 7) return t("linkshare.duration_in_x_days", "Ce paste expirera dans {{count}} jours", { count: days });
    if (days === 7) return t("linkshare.duration_in_1_week", "Ce paste expirera dans 1 semaine");
    if (days < 30)
      return t("linkshare.duration_in_x_weeks", "Ce paste expirera dans {{count}} semaines", {
        count: Math.round(days / 7)
      });
    if (days === 30) return t("linkshare.duration_in_1_month", "Ce paste expirera dans 1 mois");
    if (days < 365)
      return t("linkshare.duration_in_x_months", "Ce paste expirera dans {{count}} mois", {
        count: Math.round(days / 30)
      });
    return t("linkshare.duration_in_x_years", "Ce paste expirera dans {{count}} an(s)", {
      count: Math.round(days / 365)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    let expiresAt: Date | undefined = undefined;
    if (!neverExpires) {
      const now = new Date();
      now.setDate(now.getDate() + expiresDays);
      expiresAt = now;
    }
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PASTE",
          paste: code,
          pastelanguage: language.toUpperCase(),
          expiresAt,
          slug,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setError(data?.error || t("pasteshare_ui.creation_error", "Erreur lors de la création du partage"));
      } else {
        const pasteShare = data?.share?.pasteShare;
        if (pasteShare?.slug) setSuccess(`${window.location.origin}/p/${pasteShare.slug}`);
        else if (pasteShare?.id) setSuccess(`${window.location.origin}/p/${pasteShare.id}`);
        else setSuccess(t("pasteshare_ui.created", "Partage créé"));
      }
    } catch {
      setError(t("pasteshare_ui.network_error", "Erreur réseau — impossible de créer le partage"));
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    // Show loading while fetching settings
    if (settingsLoading) {
      return (
        <div className="text-center p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-[var(--surface)] rounded w-1/2 mx-auto mb-4"></div>
            <div className="h-4 bg-[var(--surface)] rounded w-3/4 mx-auto"></div>
          </div>
        </div>
      );
    }

    // Block anonymous users if allowAnonPasteShare is disabled
    if (!allowAnonPasteShare) {
      return (
        <div className="text-center p-6">
          <div className="h-12 w-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-700/50 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            {t("pasteshare.locked_title", "Paste sharing is locked")}
          </h2>
          <p className="text-[var(--foreground-muted)] mb-4">
            {t(
              "pasteshare.locked_message",
              "You must be logged in to share code."
            )}
          </p>
        </div>
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-900/80 text-red-200 border border-red-700 rounded p-3 mb-2 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/80 text-green-200 border border-green-700 rounded p-4 mb-2 text-sm">
          <div className="text-center space-y-3">
            <span>{t("pasteshare_ui.success", "Partage créé !")}</span>
            <div>
              <a href={success} className="underline break-all hover:text-green-100 transition-colors" target="_blank" rel="noopener noreferrer">
          {success}
              </a>
            </div>
            <div className="flex justify-center">
              <QRCodeSVG value={success} size={128} bgColor="#ffffff" fgColor="#1f2937" className="rounded-xl shadow-2xl" />
            </div>
          </div>
        </div>
      )}
      {loading && (
        <div className="text-[var(--primary-hover)] mb-2 text-sm">{t("pasteshare_ui.loading", "Création en cours...")}</div>
      )}
    {/* Sélection du langage */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--foreground)]">
          {t("pasteshare_ui.label_language")}
        </label>
        <select value={language} onChange={(e) => onLanguageChange(e.target.value)} className="input-paste w-full">
          <option value="">{t("pasteshare_ui.language_placeholder")}</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Gestion de la durée d'expiration */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-[var(--foreground)]">
          {t("pasteshare_ui.label_expiration")}
        </label>

        {isAuthenticated && (
          <div className="bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50">
            <label className="flex items-center gap-4 cursor-pointer hover:bg-[var(--surface)]/30 rounded-lg p-3 -m-3 transition-colors">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={neverExpires}
                  onChange={(e) => setNeverExpires(e.target.checked)}
                  className="sr-only"
                />
                <div className={`toggle-slider ${neverExpires ? 'toggle-slider-active' : ''}`}>
                  <div className={`toggle-slider-thumb ${neverExpires ? 'toggle-slider-thumb-active' : ''}`}></div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--foreground)] mb-1">
                  {t("pasteshare_ui.expiration_never", "Aucune expiration")}
                </div>
                <div className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                  {t("pasteshare_ui.never_expires_desc", "Ce paste n'expirera jamais")}
                </div>
              </div>
            </label>
          </div>
        )}

        <div className={`flex items-center gap-3 ${isAuthenticated && neverExpires ? "opacity-50" : ""}`}>
          <div className="flex-1">
            <input
              type="number"
              min={1}
              max={isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON}
              value={expiresDays}
              onChange={(e) => setExpiresDays(Number(e.target.value))}
              disabled={isAuthenticated && neverExpires}
              className="input-paste w-full disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <span className="text-sm text-[var(--foreground-muted)] min-w-0">{t("linkshare.days", "jours")}</span>
        </div>

        <div className="text-xs text-[var(--foreground-muted)] bg-[var(--surface)]/30 p-3 rounded-xl border border-[var(--border)]/30">
          <div className="flex items-center gap-2">
            <svg
              className="w-3 h-3 text-[var(--primary)] flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{getDurationText()}</span>
          </div>
        </div>

        {!isAuthenticated && (
          <p className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded p-2 text-[var(--foreground-muted)]">
            💡{" "}
            {t(
              "linkshare.login_for_more",
              "Connectez-vous pour des durées plus longues (jusqu'à {{max}} jours) ou sans expiration",
              { max: MAX_DAYS_AUTH }
            )}
          </p>
        )}
      </div>

      {/* Paramètres avancés */}
      <div className="bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50 space-y-4">
        <h3 className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
            />
          </svg>
          {t("pasteshare_ui.advanced")}
        </h3>

        <div className="space-y-3">
          {/* Slug personnalisé */}
          <div>
            <label htmlFor="paste-slug" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              {t("pasteshare_ui.custom_slug")}
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center items-center gap-2">
              {/* hide origin on very small screens to avoid overflow */}
              <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap hidden xs:inline-block sm:inline-block md:inline-block lg:inline-block">
                {typeof window !== "undefined" ? window.location.origin + "/p/" : "/p/"}
              </span>
              <div className="flex-1 min-w-0">
                <input
                  id="paste-slug"
                  type="text"
                  placeholder={t("pasteshare_ui.placeholder_slug", "mon-paste")}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  pattern="[a-zA-Z0-9-_]+"
                  className="input-paste w-full truncate"
                />
              </div>
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              {t("pasteshare_ui.slug_hint")}
            </p>
          </div>

          {/* Protection par mot de passe */}
          <div>
            <label htmlFor="paste-password" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              {t("pasteshare_ui.label_password")}
            </label>
            <div className="relative">
              <input
                id="paste-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="input-paste w-full pr-12"
                placeholder={t("pasteshare_ui.placeholder_password") as string}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button 
          type="submit" 
          disabled={loading || !code.trim()}
          className="btn-paste w-full inline-flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {t("pasteshare_ui.creating", "Création en cours...")}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                />
              </svg>
              {t("pasteshare_ui.submit", "Créer le paste")}
            </>
          )}
        </button>
      </div>
      
      <style jsx global>{`
        .input-paste {
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          background: var(--surface);
          color: var(--foreground);
          transition: all 0.2s ease;
        }
        .input-paste:focus {
          outline: none;
          border-color: var(--primary);
          background: var(--background);
          box-shadow: 0 0 0 3px rgb(from var(--primary) r g b / 0.1);
        }
        .input-paste::placeholder {
          color: var(--foreground-muted);
          opacity: 1;
        }
        .btn-paste {
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          color: #fff;
          border-radius: 0.75rem;
          font-weight: 600;
          box-shadow: 0 4px 14px 0 rgb(from var(--primary) r g b / 0.25);
          transition: all 0.3s ease;
        }
        .btn-paste:hover:not(:disabled) {
          background: linear-gradient(135deg, var(--primary-dark) 0%, var(--secondary-dark) 100%);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px 0 rgb(from var(--primary) r g b / 0.4);
        }
        .toggle-slider {
          width: 2.75rem;
          height: 1.5rem;
          background-color: var(--surface);
          border-radius: 0.75rem;
          position: relative;
          transition: all 0.3s ease;
          border: 2px solid var(--border);
        }
        .toggle-slider-active {
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          border-color: var(--secondary);
        }
        .toggle-slider-thumb {
          width: 1rem;
          height: 1rem;
          background-color: #ffffff;
          border-radius: 50%;
          position: absolute;
          top: 0.125rem;
          left: 0.125rem;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .toggle-slider-thumb-active {
          transform: translateX(1.25rem);
        }
      `}</style>
    </form>
  );
};

export default ManageCodeBlock;
