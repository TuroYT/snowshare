import React from "react";
// ...existing code...

import CodeBlock from "./pasteShareComponents/CodeBlock";
import ManageCodeBlock from "./pasteShareComponents/ManageCodeBlock";

const PasteShare: React.FC = () => {
  // translation not needed here
  const [code, setCode] = React.useState(`function helloWorld() {
    console.log("Hello, world!");
  }`);
  const [language, setLanguage] = React.useState("javascript");

  // Génération du lien (à adapter selon la logique réelle)

  return (
    <div className="w-full flex flex-col lg:flex-row gap-8">
      {/* Header avec icône */}
      <div className="flex items-center gap-4 mb-6 lg:hidden">
        <div className="modern-icon-green">
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">Partager du code</h2>
          <p className="text-sm text-gray-400">Créez un snippet de code partageable</p>
        </div>
      </div>

      {/* Grand éditeur de code */}
      <div className="flex-1">
        <div className="modern-card p-6 min-h-[60vh] lg:min-h-[70vh]">
          <div className="hidden lg:flex items-center gap-4 mb-6">
            <div className="modern-icon-green">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Partager du code</h2>
              <p className="text-sm text-gray-400">Créez un snippet de code partageable</p>
            </div>
          </div>
          <CodeBlock code={code} language={language} onChange={setCode} />
        </div>
      </div>
      
      {/* Formulaire à droite sur desktop, en bas sur mobile */}
      <div className="w-full lg:w-96 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <div className="modern-card p-6">
          <ManageCodeBlock
            code={code}
            onCodeChange={setCode}
            language={language}
            onLanguageChange={setLanguage}
          />
        </div>
      </div>
    </div>
  );
};

export default PasteShare;
