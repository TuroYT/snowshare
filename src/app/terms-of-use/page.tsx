"use client";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";

export default function TermsOfUse() {
  const { t } = useTranslation();
  const [termsOfUseText, setTermsOfUseText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchTermsOfUse = async () => {
      try {
        const response = await fetch("/api/terms-of-use");
        if (response.ok) {
          const text = await response.text();
          setTermsOfUseText(text);
        } else {
          setError(t("terms_of_use.error_load", "Failed to load terms of use."));
        }
      } catch (err) {
        setError(
          t("terms_of_use.error_generic", "An error occurred while loading the terms of use.")
        );
        console.error("Failed to fetch terms of use:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTermsOfUse();
  }, [t]);

  let content: React.ReactNode;
  if (loading)
    content = (
      <p role="status" className="flex items-center gap-2 text-[var(--foreground-muted)]">
        <Spinner size="sm" />
        {t("terms_of_use.loading", "Loading terms of use...")}
      </p>
    );
  else if (error) content = <Alert variant="danger">{error}</Alert>;
  else content = <ReactMarkdown>{termsOfUseText}</ReactMarkdown>;

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-grow prose mx-auto w-full max-w-[70ch] px-4 py-8 sm:py-12">
        {content}
      </main>
      <Footer />
    </div>
  );
}
