import React from "react";
import { useTranslation } from "react-i18next";
import CodeBlock from "./pasteShareComponents/CodeBlock";
import ManageCodeBlock from "./pasteShareComponents/ManageCodeBlock";

const PasteShare: React.FC = () => {
  const { t } = useTranslation();
  const [code, setCode] = React.useState(`function helloWorld() {
    console.log("Hello, world!");
  }`);
  const [language, setLanguage] = React.useState("javascript");

  return (
    <div className="w-full min-h-screen flex flex-col gap-6 p-4 lg:p-6">
      {/* Grand éditeur de code - presque fullscreen */}
      <div className="flex-1 bg-[#181f2a] rounded-2xl shadow-xl border border-[#232a38] p-4 lg:p-6 min-h-[60vh] lg:min-h-[70vh]">
        <CodeBlock code={code} language={language} onChange={setCode} />
      </div>
      
      {/* Formulaire en bas sur mobile, à droite sur desktop aligné avec le CodeBlock */}
      <div className="w-full lg:fixed lg:top-[calc(21.3rem)] lg:right-6 lg:w-80 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <div className="bg-[#181f2a] rounded-2xl shadow-xl border border-[#232a38] p-4 lg:p-6">
          <ManageCodeBlock
            code={code}
            onCodeChange={setCode}
            language={language}
            onLanguageChange={setLanguage}
          />
        </div>
      </div>
      
      <style jsx global>{`
        .input-paste {
          border: 1px solid #232a38;
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.97rem;
          background: #232a38;
          color: #e2e8f0;
          transition: border-color 0.2s, background 0.2s;
        }
        .input-paste:focus {
          outline: none;
          border-color: #2563eb;
          background: #181f2a;
        }
        .input-paste::placeholder {
          color: #64748b;
          opacity: 1;
        }
        .btn-paste {
          background: linear-gradient(90deg,#2563eb 60%,#1e40af 100%);
          color: #fff;
          border-radius: 0.75rem;
          font-weight: 500;
          box-shadow: 0 2px 8px 0 #232a38;
          transition: background 0.2s;
        }
        .btn-paste:hover {
          background: linear-gradient(90deg,#1e40af 60%,#2563eb 100%);
        }
        label {
          color: #e2e8f0;
        }
        
        /* Ajustements responsive pour le grand éditeur */
        @media (min-width: 1024px) {
          .main-editor {
            margin-right: 22rem; /* Espace pour le formulaire fixe */
          }
        }
      `}</style>
    </div>
  );
};

export default PasteShare;
