"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";

const LANGUAGES = [
  { value: "plaintext", label: "Plain" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "php", label: "PHP" },
  { value: "go", label: "Go" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "json", label: "JSON" }
];

const ManageCodeBlock: React.FC<{
  code: string;
  onCodeChange?: (v: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
}> = ({ language, onLanguageChange }) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [expiration, setExpiration] = React.useState(() => (isAuthenticated ? "30" : "7"));
  const [password, setPassword] = React.useState("");

  React.useEffect(() => {
    setExpiration((prev) => {
      if (prev === "7" && isAuthenticated) return "30";
      if (prev === "30" && !isAuthenticated) return "7";
      return prev;
    });
  }, [isAuthenticated]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium mb-1">{t("pasteshare_ui.label_title")}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input-paste w-full"
          placeholder={t("pasteshare_ui.label_title") as string}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="input-paste w-full"
          placeholder="ex: mon-slug-personnalisé"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t("pasteshare_ui.label_language")}</label>
        <select value={language} onChange={(e) => onLanguageChange(e.target.value)} className="input-paste w-full">
          <option value="">{t("pasteshare_ui.language_placeholder")}</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t("pasteshare_ui.label_expiration")}</label>
        <select value={expiration} onChange={(e) => setExpiration(e.target.value)} className="input-paste w-full">
          {!isAuthenticated && <option value="7">{t("pasteshare_ui.expiration_7_days")}</option>}
          <option value="30">{t("pasteshare_ui.expiration_30_days")}</option>
          <option value="never">{t("pasteshare_ui.expiration_never")}</option>
        </select>
        {!isAuthenticated && <p className="text-xs text-muted mt-1">{t("linkshare.login_for_more", { max: 365 })}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t("pasteshare_ui.label_password")}</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          className="input-paste w-full"
          placeholder={t("pasteshare_ui.placeholder_password") as string}
        />
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn-paste px-5 py-2 text-sm">
          {t("pasteshare_ui.submit")}
        </button>
      </div>
    </form>
  );
};

export default ManageCodeBlock;
