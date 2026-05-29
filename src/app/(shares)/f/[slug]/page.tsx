"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import Footer from "@/components/Footer";
import Link from "next/link";
import { formatBytes } from "@/lib/formatSize";
import FilePreviewModal from "@/components/filePreview/FilePreviewModal";
import { Button, Badge, Input, Spinner } from "@/components/ui";

interface FileListItem {
  name: string;
  path: string;
  size: number;
}

interface FileInfo {
  filename: string;
  fileSize?: number;
  requiresPassword: boolean;
  isBulk?: boolean;
  fileCount?: number;
  files?: FileListItem[];
}

function FilePasswordGate({
  onSubmit,
  password,
  setPassword,
  loading,
  error,
  t,
}: {
  onSubmit: (e: React.FormEvent) => void;
  password: string;
  setPassword: (v: string) => void;
  loading: boolean;
  error: string;
  t: TFunction;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 space-y-4"
    >
      <p className="text-sm text-[var(--foreground-muted)]">
        {t("file_download.password_protected")}
      </p>
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("file_download.password_placeholder")}
        error={error || undefined}
      />
      <Button type="submit" isLoading={loading} className="w-full">
        {t("file_download.verify_password")}
      </Button>
    </form>
  );
}

function BulkFileList({
  files,
  formatFileSize,
  onFileClick,
  t,
}: {
  files: FileListItem[];
  formatFileSize: (bytes?: number) => string;
  onFileClick: (f: FileListItem) => void;
  t: TFunction;
}) {
  return (
    <ul
      className="divide-y divide-[var(--border)]"
      role="list"
      aria-label={t("file_download.files_list_aria", "Files in this share, {{count}} items", {
        count: files.length,
      })}
    >
      {files.map((f) => (
        <li
          key={f.path}
          className="flex items-center justify-between py-2.5 gap-4 cursor-pointer hover:bg-[var(--surface-hover)] -mx-2 px-2 rounded transition-colors"
          aria-label={`${f.path}, ${formatFileSize(f.size)}`}
          onClick={() => onFileClick(f)}
        >
          <div className="min-w-0">
            <p className="text-sm text-[var(--foreground)] truncate">{f.name}</p>
            <p className="text-xs text-[var(--foreground-muted)]">{formatFileSize(f.size)}</p>
          </div>
          <a
            href={`/api/shares/fileShare/download?path=${encodeURIComponent(f.path)}`}
            className="shrink-0 text-xs text-[var(--primary)] hover:underline"
            download
            onClick={(e) => e.stopPropagation()}
          >
            {t("file_download.download", "Download")}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function FileSharePage() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [useGiB, setUseGiB] = useState(false);
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [downloadAbortController, setDownloadAbortController] = useState<AbortController | null>(
    null
  );
  const params = useParams();
  const slug = params?.slug as string;

  // Fetch settings to get unit format preference
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          // Check user authentication status and set appropriate unit
          const sessionResponse = await fetch("/api/auth/session");
          if (sessionResponse.ok) {
            const session = await sessionResponse.json();
            if (session?.user) {
              setUseGiB(data.settings?.useGiBForAuth ?? false);
            } else {
              setUseGiB(data.settings?.useGiBForAnon ?? false);
            }
          } else {
            setUseGiB(data.settings?.useGiBForAnon ?? false);
          }
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
        setUseGiB(false);
      }
    };
    fetchSettings();
  }, []);

  // Fetch file info on load
  useEffect(() => {
    const fetchFileInfo = async () => {
      try {
        const response = await fetch(`/f/${slug}/api`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "info" }),
        });

        const data = await response.json();

        if (response.ok) {
          setFileInfo(data);
        } else {
          setError(data.error || t("file_download.loading_error"));
        }
      } catch {
        setError(t("file_download.connection_error"));
      } finally {
        setLoadingInfo(false);
      }
    };

    fetchFileInfo();
  }, [slug, t]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError(t("file_download.password_required"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/f/${slug}/api`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "info",
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setFileInfo(data);
        setPasswordSubmitted(true);
      } else {
        setError(data.error || t("file_download.password_incorrect"));
      }
    } catch {
      setError(t("file_download.connection_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (fileInfo?.requiresPassword && !passwordSubmitted) {
      setError(t("file_download.password_required"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/f/${slug}/api`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "download",
          password: password || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.downloadUrl) {
          if (data.isBulk) {
            await handleBulkDownload(data.downloadUrl);
          } else {
            const link = document.createElement("a");
            link.href = data.downloadUrl;
            link.download = fileInfo?.filename || "download";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }
      } else {
        const data = await response.json();
        setError(data.error || t("file_download.download_error"));
      }
    } catch {
      setError(t("file_download.connection_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDownload = async (downloadUrl: string) => {
    const controller = new AbortController();
    setDownloadAbortController(controller);
    setDownloadedBytes(0);
    setTotalBytes(0);

    try {
      const response = await fetch(downloadUrl, { signal: controller.signal });

      if (!response.ok) {
        setError(t("file_download.download_error"));
        return;
      }

      const uncompressedSize = parseInt(response.headers.get("X-Uncompressed-Size") || "0", 10);
      setTotalBytes(uncompressedSize);

      const reader = response.body?.getReader();
      if (!reader) {
        setError(t("file_download.download_error"));
        return;
      }

      const chunks: BlobPart[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new Uint8Array(value.byteLength);
        chunk.set(value);
        chunks.push(chunk);
        received += value.length;
        setDownloadedBytes(received);
      }

      const blob = new Blob(chunks, { type: "application/zip" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${slug}_files.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setError(t("file_download.download_cancelled", "Download cancelled"));
      } else {
        setError(t("file_download.download_error"));
      }
    } finally {
      setDownloadAbortController(null);
      setDownloadedBytes(0);
      setTotalBytes(0);
    }
  };

  const handleCancelDownload = () => {
    downloadAbortController?.abort();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return t("file_download.unknown_size");
    return formatBytes(bytes, useGiB);
  };

  const handleFileClick = async (file: FileListItem) => {
    // Build the preview URL with absolute path (required by reactjs-file-preview)
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const previewUrl = `${origin}/f/${slug}/file-preview?relativePath=${encodeURIComponent(file.path)}${password ? `&password=${encodeURIComponent(password)}` : ""}`;

    setPreviewFile({
      url: previewUrl,
      name: file.name,
    });
  };

  const handleSingleFilePreview = () => {
    // For single files (non-bulk), use the download route
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const previewUrl = `${origin}/f/${slug}/download${password ? `?password=${encodeURIComponent(password)}` : ""}`;

    setPreviewFile({
      url: previewUrl,
      name: fileInfo?.filename || "file",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Loading state */}
          {loadingInfo && (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {/* Error state when no file info */}
          {!loadingInfo && !fileInfo && error && (
            <div className="text-center py-12 space-y-4">
              <p className="text-[var(--foreground-muted)]">{error}</p>
              <Link
                href="/"
                className="inline-flex items-center text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
              >
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t("file_download.back_to_home")}
              </Link>
            </div>
          )}

          {/* File header */}
          {fileInfo && (
            <div className="mb-6">
              <Badge variant="muted" className="mb-3">
                {t("file_download.badge", "File")}
              </Badge>
              <h1 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">
                {fileInfo.filename ?? fileInfo.files?.[0]?.name ?? t("loading")}
              </h1>
              {fileInfo.isBulk && fileInfo.fileCount && (
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  {t("file_download.file_count", "{{count}} files", { count: fileInfo.fileCount })}
                </p>
              )}
              {fileInfo.fileSize && (
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  {formatBytes(fileInfo.fileSize, useGiB)}
                </p>
              )}
            </div>
          )}

          {/* Password gate */}
          {fileInfo?.requiresPassword && !passwordSubmitted && (
            <FilePasswordGate
              onSubmit={handlePasswordSubmit}
              password={password}
              setPassword={setPassword}
              loading={loading}
              error={error}
              t={t}
            />
          )}

          {/* Download area */}
          {fileInfo && (!fileInfo.requiresPassword || passwordSubmitted) && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 space-y-4">
              {/* Error message inside download area */}
              {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

              {fileInfo.isBulk && fileInfo.files && fileInfo.files.length > 0 ? (
                <BulkFileList
                  files={fileInfo.files}
                  formatFileSize={formatFileSize}
                  onFileClick={handleFileClick}
                  t={t}
                />
              ) : (
                <>
                  {/* Single file preview button */}
                  {!fileInfo.isBulk && (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={handleSingleFilePreview}
                    >
                      {t("file_download.preview", "Preview")}
                    </Button>
                  )}

                  {/* Download progress bar */}
                  {downloadedBytes > 0 && totalBytes > 0 && (
                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--primary)] transition-all"
                          style={{ width: `${Math.round((downloadedBytes / totalBytes) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--foreground-muted)] text-right">
                        {formatBytes(downloadedBytes, useGiB)} / {formatBytes(totalBytes, useGiB)}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => handleDownload()}
                      isLoading={loading && !downloadAbortController}
                      className="flex-1"
                    >
                      {t("file_download.download")}
                    </Button>
                    {downloadAbortController && (
                      <Button variant="danger" onClick={handleCancelDownload}>
                        {t("file_download.cancel_download", "Cancel")}
                      </Button>
                    )}
                  </div>
                </>
              )}

              {/* Disclaimer */}
              <p className="text-xs text-[var(--foreground-muted)] text-center">
                {t("file_download.disclaimer")}
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* File preview modal */}
      {previewFile && (
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          fileUrl={previewFile.url}
          fileName={previewFile.name}
        />
      )}
    </div>
  );
}
