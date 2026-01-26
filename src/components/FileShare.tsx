"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { QRCodeSVG } from "qrcode.react";
import { Alert, AlertTitle, Snackbar, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import * as tus from "tus-js-client";
import { formatBytes, convertFromMB } from "@/lib/formatSize";
import LockedShare from "./shareComponents/LockedShare";

const MAX_DAYS_ANON = 7;
const MAX_DAYS_AUTH = 365;
const MAX_FILE_SIZE_ANON = 50 * 1024 * 1024; // 50MB
const MAX_FILE_SIZE_AUTH = 500 * 1024 * 1024; // 500MB

interface FileWithPath {
  file: File;
  relativePath: string;
}

const FileShare: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileWithPath[]>([]);
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
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState<number>(150);
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
          // Set upload limits from settings (convert MB to bytes)
          if (data.settings?.anoMaxUpload) {
            setMaxFileSizeAnon(data.settings.anoMaxUpload * 1024 * 1024);
          }
          if (data.settings?.authMaxUpload) {
            setMaxFileSizeAuth(data.settings.authMaxUpload * 1024 * 1024);
          }
          // Set unit format preferences
          setUseGiBForAnon(data.settings?.useGiBForAnon ?? false);
          setUseGiBForAuth(data.settings?.useGiBForAuth ?? false);
        } else {
          // Default to hardcoded values if settings can't be fetched
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

  // Format file size using the formatBytes utility
  const formatFileSize = (bytes: number): string => {
    return formatBytes(bytes, useGiB);
  };

  // Validate file
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

  const getTotalSize = () => {
    return files.reduce((sum, f) => sum + f.file.size, 0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const fileList: FileWithPath[] = Array.from(selectedFiles).map((file) => ({
        file,
        relativePath: file.name,
      }));
      setFiles(fileList);
      setError(null);
    }
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const fileList: FileWithPath[] = Array.from(selectedFiles).map((file) => {
        const fullPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        return {
          file,
          relativePath: fullPath,
        };
      });
      setFiles(fileList);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    const filePromises: Promise<FileWithPath[]>[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry?.() as FileSystemEntry | null;
        if (entry) {
          filePromises.push(traverseFileTree(entry, ""));
        }
      }
    }

    Promise.all(filePromises).then((results) => {
      const allFiles = results.flat();
      setFiles(allFiles);
      setError(null);
    });
  };

  const traverseFileTree = async (
    entry: FileSystemEntry,
    path: string
  ): Promise<FileWithPath[]> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file((file: File) => {
          const relativePath = path + file.name;
          resolve([{ file, relativePath }]);
        });
      } else if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader();
        dirReader.readEntries(async (entries: FileSystemEntry[]) => {
          const results = await Promise.all(
            entries.map((e) => traverseFileTree(e, path + entry.name + "/"))
          );
          resolve(results.flat());
        });
      } else {
        resolve([]);
      }
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // File input change handler (kept for backward compatibility)
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copying to clipboard:", err);
    }
  };

  // Get duration text
  const getDurationText = () => {
    const days = expiresDays;
    if (isAuthenticated && neverExpires)
      return t("fileshare.duration_never", "This file will never expire");
    if (days === 1)
      return t("fileshare.duration_in_1_day", "This file will expire in 1 day");
    if (days < 7)
      return t(
        "fileshare.duration_in_x_days",
        "This file will expire in {{count}} days",
        { count: days }
      );
    if (days === 7)
      return t(
        "fileshare.duration_in_1_week",
        "This file will expire in 1 week"
      );
    if (days < 30)
      return t(
        "fileshare.duration_in_x_weeks",
        "This file will expire in {{count}} weeks",
        {
          count: Math.round(days / 7),
        }
      );
    if (days === 30)
      return t(
        "fileshare.duration_in_1_month",
        "This file will expire in 1 month"
      );
    if (days < 365)
      return t(
        "fileshare.duration_in_x_months",
        "This file will expire in {{count}} months",
        {
          count: Math.round(days / 30),
        }
      );
    return t(
      "fileshare.duration_in_x_years",
      "This file will expire in {{count}} year(s)",
      {
        count: Math.round(days / 365),
      }
    );
  };

  // Responsive QR size
  useEffect(() => {
    const update = () => {
      try {
        const w = window.innerWidth;
        if (w < 480) setQrSize(110);
        else if (w < 640) setQrSize(140);
        else if (w < 1024) setQrSize(160);
        else setQrSize(200);
      } catch {
        setQrSize(150);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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

    if (files.length === 0) {
      setError(t("fileshare.file_required", "At least one file is required"));
      return;
    }

    const totalSize = getTotalSize();
    const maxTotalMB = isAuthenticated ? (maxFileSizeAuth / (1024 * 1024)) : (maxFileSizeAnon / (1024 * 1024));
    const maxTotalBytes = maxTotalMB * 1024 * 1024;

    if (totalSize > maxTotalBytes) {
      const maxValue = convertFromMB(maxTotalMB, useGiB);
      const unit = useGiB ? "GiB" : "MiB";
      setError(
        t(
          "fileshare.total_size_too_large",
          "Total size exceeds limit (max {{max}} {{unit}})",
          { max: maxValue, unit }
        )
      );
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    if (files.length === 1) {
      if (!tus.isSupported) {
        setError(t("fileshare.browser_not_supported", "Your browser does not support resumable uploads"));
        setLoading(false);
        return;
      }

      const file = files[0].file;
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setLoading(false);
        return;
      }

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

            setFiles([]);
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
    } else {
      try {
        const formData = new FormData();

        files.forEach((fileWithPath, index) => {
          formData.append(`file_${index}`, fileWithPath.file);
          formData.append(`file_${index}_path`, fileWithPath.relativePath);
        });

        if (!isAuthenticated || !neverExpires) {
          const cap = isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON;
          const days = Math.max(1, Math.min(Number(expiresDays) || 1, cap));
          const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          formData.append("expiresAt", expiresAt);
        }

        if (slug.trim()) formData.append("slug", slug.trim());
        if (password.trim()) formData.append("password", password.trim());

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener("load", () => {
          setLoading(false);
          if (xhr.status === 201) {
            const response = JSON.parse(xhr.responseText);
            const shareUrl = `${window.location.origin}/f/${response.share.slug}`;
            setSuccess(shareUrl);
            setFiles([]);
            setSlug("");
            setPassword("");
          } else {
            const response = JSON.parse(xhr.responseText);
            setError(response.error || t("fileshare.upload_failed", "Upload failed"));
          }
        });

        xhr.addEventListener("error", () => {
          setLoading(false);
          setError(t("fileshare.upload_error", "An error occurred during upload"));
        });

        xhr.open("POST", "/api/upload/bulk");
        xhr.send(formData);
      } catch {
        setLoading(false);
        setError(t("fileshare.upload_error", "An error occurred during upload"));
      }
    }
  };

  if (!isAuthenticated) {
    return <LockedShare type="file" isLoading={settingsLoading} isLocked={!allowAnonFileShare} />;
  }

  return (
    <div className="bg-[var(--surface)] bg-opacity-95 p-6 rounded-2xl shadow-2xl border border-[var(--border)]/50 w-full max-w-2xl mx-auto">
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

          {files.length === 0 ? (
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 ${
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
                    {t("fileshare.drag_drop", "Drag & drop files or folders here")}
                  </p>
                  <p className="text-[var(--foreground-muted)] text-sm mt-1">
                    {t(
                      "fileshare.or_click", 
                      "or click to select"
                    )}
                  </p>
                </div>
                <div className="flex gap-2 justify-center flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-md transition-colors text-sm"
                  >
                    {t("fileshare.select_files", "Select Files")}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dirInputRef.current?.click();
                    }}
                    className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--secondary-hover)] text-white rounded-md transition-colors text-sm"
                  >
                    {t("fileshare.select_folder", "Select Folder")}
                  </button>
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
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-[var(--foreground)]">
                  {t("fileshare.selected_files", "Selected Files")} ({files.length})
                </h3>
                <p className="text-sm text-[var(--foreground-muted)]">
                  {t("fileshare.total_size", "Total")}: {formatFileSize(getTotalSize())}
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {files.map((fileWithPath, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-2 px-3 bg-[var(--background)] rounded border border-[var(--border)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate text-[var(--foreground)]">
                        {fileWithPath.relativePath}
                      </p>
                      <p className="text-xs text-[var(--foreground-muted)]">
                        {formatFileSize(fileWithPath.file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="ml-2 text-red-500 hover:text-red-600 transition-colors"
                      title={t("common.remove", "Remove")}
                    >
                      <svg
                        className="h-5 w-5"
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
                ))}
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
            accept="*/*"
          />
          <input
            ref={dirInputRef}
            type="file"
            onChange={handleDirectorySelect}
            className="hidden"
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
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

        {/* Expiration Settings */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            {t("fileshare.validity_label", "Validity duration")}
          </label>

          {isAuthenticated && (
            <div className="bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50">
              <label className="flex items-center gap-4 cursor-pointer hover:bg-[var(--surface)]/30 rounded-lg p-3 -m-3 transition-colors">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={neverExpires}
                    onChange={(e) => setNeverExpires(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`toggle-slider ${
                      neverExpires ? "toggle-slider-active" : ""
                    }`}
                  >
                    <div
                      className={`toggle-slider-thumb ${
                        neverExpires ? "toggle-slider-thumb-active" : ""
                      }`}
                    ></div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--foreground)] mb-1">
                    {t("fileshare.never_expires", "Aucune expiration")}
                  </div>
                  <div className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                    {t(
                      "fileshare.never_expires_desc",
                      "Ce fichier restera disponible indéfiniment"
                    )}
                  </div>
                </div>
              </label>
            </div>
          )}

          <div
            className={`flex items-center gap-3 ${
              isAuthenticated && neverExpires ? "opacity-50" : ""
            }`}
          >
            <div className="flex-1">
              <input
                id="expires"
                type="number"
                min={1}
                max={isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON}
                value={expiresDays}
                onChange={(e) => setExpiresDays(Number(e.target.value))}
                disabled={isAuthenticated && neverExpires}
                className="input-paste w-full disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <span className="text-sm text-[var(--foreground-muted)] min-w-0">
              {t("fileshare.days", "days")}
            </span>
          </div>

          <div className="text-xs text-[var(--foreground-muted)] bg-[var(--surface)]/30 p-3 rounded-xl border border-[var(--border)]/30">
            <div className="flex items-center gap-2">
              <svg
                className="w-3 h-3 text-[var(--primary)] flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{getDurationText()}</span>
            </div>
          </div>

          {!isAuthenticated && (
            <p className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded p-2 text-[var(--foreground-muted)]">
              💡{" "}
              {t(
                "fileshare.login_for_more",
                "Log in for longer durations (up to {{max}} days) or no expiration and larger files (up to {{maxSize}} {{unit}})",
                {
                  max: MAX_DAYS_AUTH,
                  maxSize: convertFromMB(Math.round(maxFileSizeAuth / (1024 * 1024)), useGiB),
                  unit: useGiB ? "GiB" : "MiB"
                }
              )}
            </p>
          )}
        </div>

        {/* Advanced Settings */}
        <div className="bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50 space-y-4">
          <h3 className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
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
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
              />
            </svg>
            {t("fileshare.advanced", "Advanced settings (optional)")}
          </h3>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="slug"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                {t("fileshare.custom_slug", "Custom link")}
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center items-center gap-2">
                <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">
                  {typeof window !== "undefined"
                    ? window.location.origin + "/f/"
                    : "/f/"}
                </span>
                <input
                  id="slug"
                  type="text"
                  placeholder={t(
                    "fileshare.placeholder_slug",
                    "mon-fichier-custom"
                  )}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  pattern="[a-zA-Z0-9-_]+"
                  className="modern-input flex-1"
                />
              </div>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {t(
                  "fileshare.slug_hint",
                  "Letters, numbers, dashes and underscores only"
                )}
              </p>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                {t("fileshare.password_protect", "Password protection")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  placeholder={t(
                    "fileshare.password_placeholder",
                    "Optionnel - laissez vide pour un accès libre"
                  )}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="modern-input w-full pr-12"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg
                    className="w-4 h-4 text-[var(--foreground-muted)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || files.length === 0}
            className="btn-paste w-full inline-flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {t("fileshare.creating", "Création en cours...")}
              </>
            ) : (
              <>
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
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                {t("fileshare.submit", "Partager le fichier")}
              </>
            )}
          </button>
        </div>
      </form>

      <Snackbar
        open={!!error}
        autoHideDuration={10000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setError(null)}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setError(null)}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
          sx={{ width: "100%", maxWidth: "500px" }}
        >
          <AlertTitle>{t("fileshare.error_title", "Error")}</AlertTitle>
          {error}
        </Alert>
      </Snackbar>

      {success && (
        <div
          role="status"
          className="mt-6 bg-green-900/20 border border-green-800 rounded-lg p-4"
        >
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-green-300 mb-2">
                {t("fileshare.success_title", "File shared successfully!")}
              </h4>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--foreground-muted)] mb-1">
                    {t("fileshare.download_link", "Download link:")}
                  </p>
                  <a
                    href={success}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-green-400 hover:text-green-300 underline break-all"
                  >
                    {success}
                  </a>
                  {copied && (
                    <p className="text-xs text-green-400 mt-2">
                      {t("fileshare.copied", "✓ Copied to clipboard")}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-start gap-2">
                  <button
                    onClick={() => copyToClipboard(success)}
                    className="p-3 text-[var(--foreground-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface)]/50 rounded-lg transition-all duration-200 hover:scale-110"
                    title={t("fileshare.copy_title", "Copier le lien")}
                  >
                    {copied ? (
                      <svg
                        className="w-4 h-4 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
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
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <div className="flex flex-col items-center bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50">
                  <p className="text-sm text-[var(--foreground)] mb-2 text-center">
                    {t(
                      "fileshare.qr_info",
                      "Scan this QR code to download the file"
                    )}
                  </p>
                  <div
                    className="bg-white rounded p-2"
                    style={{ width: qrSize, height: qrSize }}
                  >
                    <QRCodeSVG
                      value={success}
                      size={qrSize - 16}
                      className="block"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input-paste {
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          background: var(--surface);
          color: var(--foreground);
          transition: all 0.2s ease;
        }
        .input-paste:focus {
          outline: none;
          border-color: var(--secondary);
          background: var(--background);
          box-shadow: 0 0 0 3px rgb(from var(--secondary) r g b / 0.1);
        }
        .input-paste::placeholder {
          color: var(--foreground-muted);
          opacity: 1;
        }
        .btn-paste {
          background: linear-gradient(
            135deg,
            var(--primary) 0%,
            var(--secondary) 100%
          );
          color: #fff;
          border-radius: 0.75rem;
          font-weight: 600;
          box-shadow: 0 4px 14px 0 rgb(from var(--primary) r g b / 0.25);
          transition: all 0.3s ease;
        }
        .btn-paste:hover:not(:disabled) {
          background: linear-gradient(
            135deg,
            var(--primary-dark) 0%,
            var(--secondary-dark) 100%
          );
          transform: translateY(-1px);
          box-shadow: 0 6px 20px 0 rgb(from var(--primary) r g b / 0.4);
        }
        label {
          color: var(--foreground);
          font-weight: 500;
        }
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
        .toggle-slider {
          width: 2.75rem;
          height: 1.5rem;
          background-color: var(--surface);
          border-radius: 0.75rem;
          position: relative;
          transition: all 0.3s ease;
          border: 2px solid var(--border);
        }
        .toggle-slider-active {
          background: linear-gradient(
            135deg,
            var(--primary) 0%,
            var(--secondary) 100%
          );
          border-color: var(--secondary);
        }
        .toggle-slider-thumb {
          width: 1rem;
          height: 1rem;
          background-color: #ffffff;
          border-radius: 50%;
          position: absolute;
          top: 0.125rem;
          left: 0.125rem;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .toggle-slider-thumb-active {
          transform: translateX(1.25rem);
        }
      `}</style>
    </div>
  );
};

export default FileShare;
