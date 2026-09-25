"use client";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";

export default function TermsOfUse() {
  const { t } = useTranslation();
  const { colors } = useTheme();
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

  return (
    <div className="min-h-screen flex flex-col" style={{ color: colors.primaryColor }}>
      <Navigation />
      <main className="flex-grow prose mx-auto p-4 w-full">
        {loading ? (
          <p>{t("terms_of_use.loading", "Loading terms of use...")}</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <ReactMarkdown>{termsOfUseText}</ReactMarkdown>
        )}
      </main>
      <Footer />
    </div>
  );
}
