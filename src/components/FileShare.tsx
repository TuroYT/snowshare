"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import * as tus from "tus-js-client";
import { formatBytes, convertFromMB } from "@/lib/formatSize";
import LockedShare from "./shareComponents/LockedShare";
import ExpirationSettings from "./shareComponents/ExpirationSettings";
import AdvancedSettings from "./shareComponents/AdvancedSettings";
import ShareSuccess from "./shareComponents/ShareSuccess";
import ShareError from "./shareComponents/ShareError";
import SubmitButton from "./shareComponents/SubmitButton";

const MAX_DAYS_ANON = 7;
const MAX_DAYS_AUTH = 365;
const MAX_FILE_SIZE_ANON = 50 * 1024 * 1024; // 50MB
const MAX_FILE_SIZE_AUTH = 500 * 1024 * 1024; // 500MB

const FileShare: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expiresDays, setExpiresDays] = useState<number>(
    isAuthenticated ? 30 : MAX_DAYS_ANON
  );
  const [neverExpires, setNeverExpires] = useState(false);
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [allowAnonFileShare, setAllowAnonFileShare] = useState<boolean | null>(
    null
  );
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [maxFileSizeAnon, setMaxFileSizeAnon] =
    useState<number>(MAX_FILE_SIZE_ANON);
  const [maxFileSizeAuth, setMaxFileSizeAuth] =
    useState<number>(MAX_FILE_SIZE_AUTH);
  const [useGiBForAnon, setUseGiBForAnon] = useState(false);
  const [useGiBForAuth, setUseGiBForAuth] = useState(false);

  const maxFileSize = isAuthenticated ? maxFileSizeAuth : maxFileSizeAnon;
  const useGiB = isAuthenticated ? useGiBForAuth : useGiBForAnon;

  // Fetch settings to check if anonymous file sharing is allowed
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setAllowAnonFileShare(data.settings?.allowAnonFileShare ?? true);
          if (data.settings?.anoMaxUpload) {
            setMaxFileSizeAnon(data.settings.anoMaxUpload * 1024 * 1024);
          }
          if (data.settings?.authMaxUpload) {
            setMaxFileSizeAuth(data.settings.authMaxUpload * 1024 * 1024);
          }
          setUseGiBForAnon(data.settings?.useGiBForAnon ?? false);
          setUseGiBForAuth(data.settings?.useGiBForAuth ?? false);
        } else {
          setAllowAnonFileShare(true);
        }
      } catch {
        setAllowAnonFileShare(true);
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchSettings();
  }, [isAuthenticated]);

  const formatFileSize = (bytes: number): string => {
    return formatBytes(bytes, useGiB);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      const maxValue = convertFromMB(
        Math.round(maxFileSize / (1024 * 1024)),
        useGiB
      );
      const unit = useGiB ? "GiB" : "MiB";
      return t(
        "fileshare.file_too_large",
        "File is too large (max {{max}} {{unit}})",
        { max: maxValue, unit }
      );
    }
    return null;
  };

  const handleFileSelect = (selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Ref to hold the active upload instance
  const uploadRef = useRef<tus.Upload | null>(null);

  // Cleanup upload on unmount
  useEffect(() => {
    return () => {
      if (uploadRef.current) {
        uploadRef.current.abort();
      }
    };
  }, []);

  // Handle form submission with tus resumable upload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!tus.isSupported) {
      setError(t("fileshare.browser_not_supported", "Your browser does not support resumable uploads"));
      return;
    }

    if (!file) {
      setError(t("fileshare.file_required", "A file is required"));
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      const metadata: Record<string, string> = {
        filename: file.name,
        filetype: file.type || "application/octet-stream",
      };

      if (!isAuthenticated || !neverExpires) {
        const cap = isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON;
        const days = Math.max(1, Math.min(Number(expiresDays) || 1, cap));
        const expiresAt = new Date(
          Date.now() + days * 24 * 60 * 60 * 1000
        ).toISOString();
        metadata.expiresAt = expiresAt;
      }

      if (slug.trim()) metadata.slug = slug.trim();
      if (password.trim()) metadata.password = password.trim();

      let shareSlug: string | null = null;

      const upload = new tus.Upload(file, {
        endpoint: "/api/tus",
        retryDelays: [0, 1000, 3000, 5000, 10000],
        chunkSize: 50 * 1024 * 1024,
        metadata,
        removeFingerprintOnSuccess: true,
        onError: (error) => {
          console.error("Tus upload error:", error);
          let errorMessage = t("fileshare.network_error", "Network error — could not create share");
          if (error && typeof error === 'object' && 'message' in error) {
            try {
              const parsed = JSON.parse(error.message as string);
              if (parsed.error) {
                errorMessage = parsed.error;
              }
            } catch {
              errorMessage = (error.message as string) || errorMessage;
            }
          }
          setError(errorMessage);
          setLoading(false);
          setUploadProgress(0);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const total = bytesTotal || file.size;
          if (total > 0) {
            const percent = Math.round((bytesUploaded / total) * 100);
            setUploadProgress(percent);
          }
        },
        onAfterResponse: (_req, res) => {
          const slugHeader = res.getHeader("X-Share-Slug");
          if (slugHeader) {
            shareSlug = slugHeader;
          }
        },
        onSuccess: () => {
          if (shareSlug) {
            setSuccess(`${window.location.origin}/f/${shareSlug}`);
          } else {
            setSuccess(t("fileshare.success_title", "File shared successfully!"));
          }
          setFile(null);
          setSlug("");
          setPassword("");
          setNeverExpires(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          setLoading(false);
          setUploadProgress(0);
          uploadRef.current = null;
        },
      });

      uploadRef.current = upload;

      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      upload.start();
    } catch (error) {
      console.error("FileShare error:", error);
      if (error instanceof Error && error.message) {
        setError(error.message);
      } else {
        setError(
          t("fileshare.network_error", "Network error — could not create share")
        );
      }
      setLoading(false);
      setUploadProgress(0);
    }
  };

  if (!isAuthenticated) {
    return <LockedShare type="file" isLoading={settingsLoading} isLocked={!allowAnonFileShare} />;
  }

  return (
    <div className="bg-[var(--surface)] bg-opacity-95 p-6 rounded-2xl shadow-2xl border border-[var(--border)]/50 w-full max-w-2xl mx-auto text-left">
      <div className="flex items-center gap-4 mb-6 justify-center">
        <div
          className="h-12 w-12 rounded-xl border border-[var(--primary-dark)]/50 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(to bottom right, rgb(from var(--primary) r g b / 0.2), rgb(from var(--primary-dark) r g b / 0.2))",
          }}
        >
          <svg
            className="w-6 h-6 text-[var(--primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            {t("fileshare.title", "Partager un fichier")}
          </h2>
          <p className="text-sm text-[var(--foreground-muted)]">
            {t(
              "fileshare.subtitle",
              "Uploadez et partagez vos fichiers en toute sécurité"
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload Area */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            {t("fileshare.file_selected", "File to share")}&nbsp;
            <span className="text-red-400">*</span>
          </label>

          {!file ? (
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${
                dragOver
                  ? "scale-105"
                  : "border-[var(--border)]/50 hover:bg-[var(--surface)]/30 hover:scale-102"
              }`}
              style={
                dragOver
                  ? {
                      borderColor: "var(--secondary)",
                      background: "rgb(from var(--secondary) r g b / 0.2)",
                    }
                  : undefined
              }
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="w-12 h-12 text-[var(--foreground-muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
                <div>
                  <p className="text-[var(--foreground)] font-medium">
                    {t("fileshare.drag_drop", "Drag & drop your file here")}
                  </p>
                  <p className="text-[var(--foreground-muted)] text-sm mt-1">
                    {t(
                      "fileshare.click_to_select",
                      "or click to select a file"
                    )}
                  </p>
                </div>
                <p className="text-xs text-[var(--foreground-muted)]">
                  {isAuthenticated
                    ? t(
                        "fileshare.max_size_auth",
                        "{{max}} {{unit}} maximum for authenticated users",
                        {
                          max: convertFromMB(Math.round(maxFileSizeAuth / (1024 * 1024)), useGiB),
                          unit: useGiB ? "GiB" : "MiB"
                        }
                      )
                    : t(
                        "fileshare.max_size_anon",
                        "{{max}} {{unit}} maximum for anonymous users",
                        {
                          max: convertFromMB(Math.round(maxFileSizeAnon / (1024 * 1024)), useGiB),
                          unit: useGiB ? "GiB" : "MiB"
                        }
                      )}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50">
              <div className="flex items-start gap-3">
                <svg
                  className="w-8 h-8 text-[var(--primary)] flex-shrink-0 mt-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                    {t("fileshare.file_selected", "Selected file:")}
                  </p>
                  <p className="text-sm text-[var(--foreground)] truncate">
                    {file.name}
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-[var(--foreground-muted)]">
                    <span>
                      {t("fileshare.file_size", "Size:")}&nbsp;
                      {formatFileSize(file.size)}
                    </span>
                    <span>
                      {t("fileshare.file_type", "Type:")}&nbsp;
                      {file.type || "Unknown"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-[var(--foreground-muted)] hover:text-white hover:bg-[var(--surface)] rounded p-1 transition-colors"
                  title={t("fileshare.change_file", "Change file")}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            className="hidden"
            accept="*/*"
          />
        </div>

        {/* Upload Progress */}
        {loading && uploadProgress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-[var(--foreground)]">
              <span>{t("fileshare.uploading", "Uploading...")}</span>
              <span>
                {t("fileshare.upload_progress", "Progress: {{progress}}%", {
                  progress: uploadProgress,
                })}
              </span>
            </div>
            <div className="w-full bg-[var(--surface)]/50 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${uploadProgress}%`,
                  background:
                    "linear-gradient(to right, var(--secondary), var(--primary))",
                  boxShadow:
                    "0 10px 15px -3px rgb(from var(--secondary) r g b / 0.25)",
                }}
              />
            </div>
          </div>
        )}

        <ExpirationSettings
          expiresDays={expiresDays}
          setExpiresDays={setExpiresDays}
          neverExpires={neverExpires}
          setNeverExpires={setNeverExpires}
          translationPrefix="fileshare"
        />

        <AdvancedSettings
          slug={slug}
          setSlug={setSlug}
          password={password}
          setPassword={setPassword}
          slugPrefix="/f/"
          translationPrefix="fileshare"
        />

        <SubmitButton
          loading={loading}
          disabled={loading || !file}
          loadingText={t("fileshare.creating", "Création en cours...")}
          submitText={t("fileshare.submit", "Partager le fichier")}
          iconPath="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </form>

      {error && <ShareError error={error} translationPrefix="fileshare" />}

      {success && (
        <ShareSuccess url={success} translationPrefix="fileshare" />
      )}
    </div>
  );
};

export default FileShare;
