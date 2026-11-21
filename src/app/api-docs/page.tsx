"use client";

import { useTranslation } from "react-i18next";

export default function ApiDocsPage() {
  const { t } = useTranslation();
  return (
    <iframe src="/scalar.html" className="w-full h-dvh border-0" title={t("api_docs.title")} />
  );
}
