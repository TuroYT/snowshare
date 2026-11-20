"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Footer from "@/components/Footer";
import { Button, Input, Spinner, Textarea } from "@/components/ui";
import { formatBytes } from "@/lib/formatSize";

interface RequestInfo {
  name: string;
  requiresPassword: boolean;
  expiresAt: string | null;
  maxSizeMB: number | null;
  isOpen: boolean;
}

export default function UploadRequestPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const [info, setInfo] = useState<RequestInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentCount, setSentCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/r/${encodeURIComponent(slug)}/api`)
      .then(async (res) => {
        const body = await res.json();
        if (res.ok) setInfo(body.data);
        else
          setError(body.error || t("reverse_upload.not_found", "This upload link does not exist."));
      })
      .catch((err) => {
        console.error("Failed to load upload request:", err);
        setError(t("reverse_upload.not_found", "This upload link does not exist."));
      })
      .finally(() => setLoading(false));
  }, [slug, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;
    setSending(true);
    setError("");
    try {
      const form = new FormData();
      if (message.trim()) form.append("message", message.trim());
      files.forEach((file, i) => form.append(`file${i}`, file, file.name));
      const res = await fetch(`/r/${encodeURIComponent(slug)}/api`, {
        method: "POST",
        headers: password ? { "X-Reverse-Share-Password": password } : undefined,
        body: form,
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || t("reverse_upload.error_send", "The files could not be sent."));
        return;
      }
      setSentCount(body.data.fileCount);
      setFiles([]);
      setMessage("");
    } catch (err) {
      console.error("Failed to send files:", err);
      setError(t("reverse_upload.error_send", "The files could not be sent."));
    } finally {
      setSending(false);
    }
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-4">
          {loading && (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {!loading && !info && (
            <p className="text-center py-12 text-[var(--foreground-muted)]">{error}</p>
          )}

          {info && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--foreground-muted)]">
                  {t("reverse_upload.heading", "Send files")}
                </p>
                <h1 className="text-xl font-semibold text-[var(--foreground)] break-words">
                  {info.name}
                </h1>
              </div>

              {!info.isOpen && (
                <p className="text-sm text-[var(--foreground-muted)]">
                  {t("reverse_upload.closed", "This upload link is closed.")}
                </p>
              )}

              {info.isOpen && sentCount !== null && (
                <div className="space-y-3">
                  <p className="text-sm text-green-400">
                    {t("reverse_upload.sent", "Sent! Files received: {{count}}", {
                      count: sentCount,
                    })}
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => setSentCount(null)}>
                    {t("reverse_upload.send_more", "Send more files")}
                  </Button>
                </div>
              )}

              {info.isOpen && sentCount === null && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="block">
                    <span className="block text-sm text-[var(--foreground)] mb-1">
                      {t("reverse_upload.files", "Files")}
                    </span>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                      className="block w-full text-sm text-[var(--foreground-muted)]"
                    />
                  </label>
                  {files.length > 0 && (
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {files.length} · {formatBytes(totalSize)}
                      {info.maxSizeMB && ` / ${formatBytes(info.maxSizeMB * 1024 * 1024)}`}
                    </p>
                  )}
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("reverse_upload.message_placeholder", "Message (optional)")}
                    maxLength={1500}
                    rows={3}
                  />
                  {info.requiresPassword && (
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("file_download.password_placeholder")}
                    />
                  )}
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <Button
                    type="submit"
                    isLoading={sending}
                    disabled={sending || files.length === 0}
                    className="w-full"
                  >
                    {t("reverse_upload.send", "Send")}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
