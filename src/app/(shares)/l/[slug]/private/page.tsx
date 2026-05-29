"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Footer from "@/components/Footer";
import { Button, Badge, Input } from "@/components/ui";

export default function PrivateLinkPage() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const slug = params?.slug as string;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/l/${slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("link_private.error_generic"));
        return;
      }

      if (data.url) {
        // Redirect to the decrypted URL
        window.location.href = data.url;
      } else {
        setError(t("link_private.error_url_not_found"));
      }
    } catch {
      setError(t("link_private.error_connection"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Badge variant="muted" className="mb-4">
            {t("link_private.badge", "Protected link")}
          </Badge>
          <h1 className="text-xl font-semibold text-[var(--foreground)] mb-6 tracking-tight">
            {t("link_private.title")}
          </h1>
          <form
            onSubmit={handleSubmit}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 space-y-4"
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label={t("link_private.password_label")}
              placeholder={t("link_private.password_placeholder")}
              error={error || undefined}
              autoComplete="current-password"
              autoFocus
              required
            />
            <Button type="submit" isLoading={loading} className="w-full">
              {t("link_private.access_link")}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
