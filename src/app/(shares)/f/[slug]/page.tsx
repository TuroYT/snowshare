"use client";

import { useState, useEffect, useRef } from "react";
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
  note?: string | null;
  /** Signed token replacing the password in per-file URLs (bulk shares) */
  accessToken?: string;
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
  onFileDownload,
  t,
}: {
  files: FileListItem[];
  formatFileSize: (bytes?: number) => string;
  onFileClick: (f: FileListItem) => void;
  onFileDownload: (f: FileListItem) => void;
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
          <button
            type="button"
            className="shrink-0 text-xs text-[var(--primary)] hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onFileDownload(f);
            }}
          >
            {t("file_download.download", "Download")}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface DownloadGrant {
  downloadUrl: string;
  isBulk: boolean;
  token: string | null;
  expiresAt: number;
}

// Renew the grant slightly before the server-side token expires
const GRANT_EXPIRY_MARGIN_MS = 60 * 1000;

export default function FileSharePage() {
  const { t } = useTranslation();
  const downloadGrantRef = useRef<DownloadGrant | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [useGiB, setUseGiB] = useState(false);
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
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

  /**
   * Returns a download grant: the server counts one view and issues a short-lived token that
   * unlocks the download, previews and individual bulk files. The grant is reused until it
   * nearly expires, so previewing then downloading costs a single view.
   */
  const getDownloadGrant = async (): Promise<DownloadGrant | null> => {
    const cached = downloadGrantRef.current;
    if (cached && cached.expiresAt - GRANT_EXPIRY_MARGIN_MS > Date.now()) return cached;

    const response = await fetch(`/f/${slug}/api`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "download",
        password: password || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.downloadUrl) {
      setError(data.error || t("file_download.download_error"));
      return null;
    }
    const grant: DownloadGrant = {
      downloadUrl: data.downloadUrl,
      isBulk: !!data.isBulk,
      token: data.token ?? null,
      expiresAt: Date.now() + (data.tokenExpiresIn ?? 0) * 1000,
    };
    downloadGrantRef.current = grant;
    return grant;
  };

  const triggerBrowserDownload = (url: string, filename: string) => {
    // Let the browser stream the file to disk (no in-memory buffering, native progress)
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filePreviewUrl = (file: FileListItem, token: string | null, download: boolean) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/f/${slug}/file-preview?relativePath=${encodeURIComponent(file.path)}${
      download ? "&download=1" : ""
    }${token ? `&token=${encodeURIComponent(token)}` : ""}`;
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
      const grant = await getDownloadGrant();
      if (grant) {
        triggerBrowserDownload(
          grant.downloadUrl,
          grant.isBulk ? `${slug}_files.zip` : fileInfo?.filename || "download"
        );
      }
    } catch (err) {
      console.error("Download request failed:", err);
      setError(t("file_download.connection_error"));
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return t("file_download.unknown_size");
    return formatBytes(bytes, useGiB);
  };

  const handleFileClick = async (file: FileListItem) => {
    setError("");
    try {
      const grant = await getDownloadGrant();
      if (!grant) return;
      // Absolute URL required by reactjs-file-preview
      setPreviewFile({ url: filePreviewUrl(file, grant.token, false), name: file.name });
    } catch (err) {
      console.error("Preview request failed:", err);
      setError(t("file_download.connection_error"));
    }
  };

  const handleFileDownload = async (file: FileListItem) => {
    setError("");
    try {
      const grant = await getDownloadGrant();
      if (!grant) return;
      triggerBrowserDownload(filePreviewUrl(file, grant.token, true), file.name);
    } catch (err) {
      console.error("File download request failed:", err);
      setError(t("file_download.connection_error"));
    }
  };

  const handleSingleFilePreview = async () => {
    setError("");
    try {
      const grant = await getDownloadGrant();
      if (!grant) return;
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setPreviewFile({
        url: `${origin}${grant.downloadUrl}`,
        name: fileInfo?.filename || "file",
      });
    } catch (err) {
      console.error("Preview request failed:", err);
      setError(t("file_download.connection_error"));
    }
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

              {/* Note / description */}
              {fileInfo.note && (
                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-hover)] p-3">
                  <p className="text-xs font-medium text-[var(--foreground-muted)] mb-1">
                    {t("file_download.note", "Note")}
                  </p>
                  <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words">
                    {fileInfo.note}
                  </p>
                </div>
              )}

              {/* Bulk: list of files (each downloadable individually) */}
              {fileInfo.isBulk && fileInfo.files && fileInfo.files.length > 0 && (
                <BulkFileList
                  files={fileInfo.files}
                  formatFileSize={formatFileSize}
                  onFileClick={handleFileClick}
                  onFileDownload={handleFileDownload}
                  t={t}
                />
              )}

              {/* Single file preview button */}
              {!fileInfo.isBulk && (
                <Button variant="secondary" className="w-full" onClick={handleSingleFilePreview}>
                  {t("file_download.preview", "Preview")}
                </Button>
              )}

              <Button onClick={() => handleDownload()} isLoading={loading} className="w-full">
                {fileInfo.isBulk
                  ? t("file_download.download_all_zip", "Download all as ZIP")
                  : t("file_download.download")}
              </Button>

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
