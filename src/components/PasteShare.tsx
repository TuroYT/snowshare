import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
// ...existing code...

import CodeBlock from "./pasteShareComponents/CodeBlock";
import ManageCodeBlock from "./pasteShareComponents/ManageCodeBlock";
import LockedShare from "./shareComponents/LockedShare";

const PasteShare: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [code, setCode] = React.useState(`function helloWorld() {
    console.log("Hello, world!");
  }`);
  const [language, setLanguage] = React.useState("javascript");

  // Contrôle admin: autoriser ou non le partage anonyme de paste
  const [allowAnonPasteShare, setAllowAnonPasteShare] = React.useState<boolean | null>(null);
  const [settingsLoading, setSettingsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setAllowAnonPasteShare(data.settings?.allowAnonPasteShare ?? true);
        } else {
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

  if (settingsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!isAuthenticated && allowAnonPasteShare === false) {
    return <LockedShare type="paste" isLoading={settingsLoading} isLocked={!allowAnonPasteShare} />;
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      {/* Header avec icône */}
      <div className="flex items-center gap-4 mb-6 lg:hidden justify-center">
        <div className="h-12 w-12 rounded-xl border border-[var(--primary)]/50 flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, rgb(from var(--primary) r g b / 0.2), rgb(from var(--primary-dark) r g b / 0.2))' }}>
          <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">{t('pasteshare.share_code_title')}</h2>
          <p className="text-sm text-[var(--foreground-muted)]">{t('pasteshare.share_code_description')}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-full flex-container-safe">
        {/* Grand éditeur de code */}
        <div className="flex-1 min-w-0 max-w-full flex-container-safe">
          <div className="bg-[var(--surface)] bg-opacity-95 p-4 rounded-2xl shadow-2xl border border-[var(--border)]/50 min-h-[60vh] lg:min-h-[70vh]">
            <div className="hidden lg:flex items-center gap-4 mb-6 justify-center">
              <div className="h-12 w-12 rounded-xl border border-[var(--primary)]/50 flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, rgb(from var(--primary) r g b / 0.2), rgb(from var(--primary-dark) r g b / 0.2))' }}>
                <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">{t('pasteshare.share_code_title')}</h2>
                <p className="text-sm text-[var(--foreground-muted)]">{t('pasteshare.share_code_description')}</p>
              </div>
            </div>
            <div className="w-full overflow-hidden">
              <CodeBlock code={code} language={language} onChange={setCode} />
            </div>
          </div>
        </div>
        
        {/* Formulaire à droite sur desktop, en bas sur mobile */}
        <div className="w-full lg:w-96 lg:flex-shrink-0 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto flex-container-safe">
          <div className="bg-[var(--surface)] bg-opacity-95 p-4 rounded-2xl shadow-2xl border border-[var(--border)]/50">
            <ManageCodeBlock
              code={code}
              onCodeChange={setCode}
              language={language}
              onLanguageChange={setLanguage}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasteShare;
