import React from "react";
import { useTranslation } from "react-i18next";
// ...existing code...

import CodeBlock from "./pasteShareComponents/CodeBlock";
import ManageCodeBlock from "./pasteShareComponents/ManageCodeBlock";

const PasteShare: React.FC = () => {
  const { t } = useTranslation();
  const [code, setCode] = React.useState(`function helloWorld() {
    console.log("Hello, world!");
  }`);
  const [language, setLanguage] = React.useState("javascript");

  // Génération du lien (à adapter selon la logique réelle)

  return (
    <div className="w-full max-w-full overflow-hidden">
      {/* Header avec icône */}
      <div className="flex items-center gap-4 mb-6 lg:hidden justify-center">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-700/50 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">{t('pasteshare.share_code_title')}</h2>
          <p className="text-sm text-gray-400">{t('pasteshare.share_code_description')}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-full flex-container-safe">
        {/* Grand éditeur de code */}
        <div className="flex-1 min-w-0 max-w-full flex-container-safe">
          <div className="modern-card p-4 min-h-[60vh] lg:min-h-[70vh]">
            <div className="hidden lg:flex items-center gap-4 mb-6 justify-center">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-700/50 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-100">{t('pasteshare.share_code_title')}</h2>
                <p className="text-sm text-gray-400">{t('pasteshare.share_code_description')}</p>
              </div>
            </div>
            <div className="w-full overflow-hidden">
              <CodeBlock code={code} language={language} onChange={setCode} />
            </div>
          </div>
        </div>
        
        {/* Formulaire à droite sur desktop, en bas sur mobile */}
        <div className="w-full lg:w-96 lg:flex-shrink-0 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto flex-container-safe">
          <div className="modern-card p-4">
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
