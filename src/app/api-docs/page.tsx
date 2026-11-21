"use client";

import { useTranslation } from "react-i18next";

export default function ApiDocsPage() {
  const { t } = useTranslation();
  return (
    <iframe
      src="/scalar.html"
      className="w-full border-0"
      style={{ height: "100vh" }}
      title={t("api_docs.title")}
    />
  );
}
