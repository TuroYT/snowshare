"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import * as tus from "tus-js-client";
import { formatBytes, convertFromMB } from "@/lib/formatSize";
import LockedShare from "./shareComponents/LockedShare";
import ExpirationSettings from "./shareComponents/ExpirationSettings";
import AdvancedSettings from "./shareComponents/AdvancedSettings";
import ViewLimitSettings from "./shareComponents/ViewLimitSettings";
import ShareSuccess from "./shareComponents/ShareSuccess";
import ShareError from "./shareComponents/ShareError";
import SubmitButton from "./shareComponents/SubmitButton";

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
  const [hasViewLimit, setHasViewLimit] = useState(false);
  const [maxViews, setMaxViews] = useState(1);
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

  const getTotalSize = () => {
    if (files.length === 0) return 0;

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
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (!entry) {
          continue;
        }
        filePromises.push(traverseFileTree(entry, ""));
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

        const readAllEntries = async (): Promise<FileSystemEntry[]> => {
          const allEntries: FileSystemEntry[] = [];

          // According to the FileSystem API spec, readEntries() must be called
          // repeatedly until it returns an empty array to get all entries.
          // See: https://www.w3.org/TR/FileAPI/#file-directory-reader
          // (Behavior implemented by WebKit/Blink as well.)
          // We use the same reader and keep reading until no more entries.

          while (true) {
            const batch: FileSystemEntry[] = await new Promise((res) => {
              dirReader.readEntries((entries: FileSystemEntry[]) => {
                res(entries);
              });
            });

            if (!batch.length) {
              break;
            }

            allEntries.push(...batch);
          }

          return allEntries;
        };

        (async () => {
          const entries = await readAllEntries();
          const results = await Promise.all(
            entries.map((e) =>
              traverseFileTree(e, path + entry.name + "/")
            )
          );
          resolve(results.flat());
        })();
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

  // Map server error codes to translated messages
  const errorCodeMap: Record<string, string> = {
    SLUG_ALREADY_TAKEN: t("api.errors.slug_already_taken", "This custom URL is already taken. Please choose another one."),
    SLUG_INVALID: t("api.errors.slug_invalid", "Invalid slug. It must contain between 3 and 30 alphanumeric characters, dashes or underscores."),
    IP_QUOTA_EXCEEDED: t("fileshare.upload_ip_quota_exceeded", "IP quota exceeded."),
    FILE_TOO_LARGE: t("fileshare.upload_file_too_large", "File size exceeds the allowed limit."),
  };

  const translateErrorCode = (code: string): string => {
    return errorCodeMap[code] || code;
  };

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

    if (!tus.isSupported) {
      setError(t("fileshare.browser_not_supported", "Your browser does not support resumable uploads"));
      setLoading(false);
      return;
    }

    try {
      const baseMetadata: Record<string, string> = {};

      if (!isAuthenticated || !neverExpires) {
        const cap = isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON;
        const days = Math.max(1, Math.min(Number(expiresDays) || 1, cap));
        const expiresAt = new Date(
          Date.now() + days * 24 * 60 * 60 * 1000
        ).toISOString();
        baseMetadata.expiresAt = expiresAt;
      }

      if (slug.trim()) baseMetadata.slug = slug.trim();
      if (password.trim()) baseMetadata.password = password.trim();
      if (hasViewLimit) baseMetadata.maxViews = maxViews.toString();

      if (files.length === 1) {
        const file = files[0].file;
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          setLoading(false);
          return;
        }

        const metadata = {
          ...baseMetadata,
          filename: file.name,
          filetype: file.type || "application/octet-stream",
          isBulk: "false",
        };

        let shareSlug: string | null = null;

        const upload = new tus.Upload(file, {
          endpoint: "/api/tus",
          retryDelays: [0, 1000, 3000, 5000, 10000],
          chunkSize: 50 * 1024 * 1024,
          metadata,
          removeFingerprintOnSuccess: true,
          onShouldRetry(err) {
            const status = err?.originalResponse?.getStatus();
            if (status && status >= 400 && status < 500) return false;
            if (status === 409) return false;
            return true;
          },
          onError: (error: unknown) => {
            console.error("Tus upload error:", error);
            let errorMessage = t("fileshare.network_error", "Network error — could not create share");
            const tusError = error as { originalResponse?: { getBody?: () => string }; message?: string };
            const body = tusError?.originalResponse?.getBody?.();
            if (body) {
              try {
                const parsed = JSON.parse(body);
                if (parsed.error) {
                  errorMessage = translateErrorCode(parsed.error);
                }
              } catch {
                errorMessage = body;
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
            setHasViewLimit(false);
            setMaxViews(1);
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
      } else {
        let shareSlug: string | null = null;
        let shareId: string | null = null;
        let completedFiles = 0;
        const totalSize = getTotalSize();

        const uploadNextFile = async (index: number) => {
          if (index >= files.length) {
            if (shareSlug) {
              setSuccess(`${window.location.origin}/f/${shareSlug}`);
            }
            setFiles([]);
            setSlug("");
            setPassword("");
            setNeverExpires(false);
            setHasViewLimit(false);
            setMaxViews(1);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
            setLoading(false);
            setUploadProgress(100);
            uploadRef.current = null;
            return;
          }

          const fileWithPath = files[index];
          const file = fileWithPath.file;

          const metadata: {
            filename: string;
            filetype: string;
            relativePath: string;
            isBulk: string;
            fileIndex: string;
            totalFiles: string;
            bulkShareId?: string;
            [key: string]: string | undefined;
          } = {
            ...baseMetadata,
            filename: file.name,
            filetype: file.type || "application/octet-stream",
            relativePath: fileWithPath.relativePath,
            isBulk: "true",
            fileIndex: index.toString(),
            totalFiles: files.length.toString(),
          };

          if (shareId) {
            metadata.bulkShareId = shareId;
          }

          // Filter out undefined values to match tus library's metadata type requirement
          const cleanMetadata = Object.fromEntries(
            Object.entries(metadata).filter(([, value]) => value !== undefined)
          ) as Record<string, string>;

          let bytesUploadedSoFar = 0;
          for (let i = 0; i < index; i++) {
            bytesUploadedSoFar += files[i].file.size;
          }

          const upload = new tus.Upload(file, {
            endpoint: "/api/tus",
            retryDelays: [0, 1000, 3000, 5000, 10000],
            chunkSize: 50 * 1024 * 1024,
            metadata: cleanMetadata,
            removeFingerprintOnSuccess: true,
            onShouldRetry(err) {
              const status = err?.originalResponse?.getStatus();
              if (status && status >= 400 && status < 500) return false;
              if (status === 409) return false;
              return true;
            },
            onError: (error: unknown) => {
              console.error(`Tus upload error for file ${index + 1}:`, error);
              let errorMessage = t("fileshare.network_error", "Network error — could not create share");
              const tusError = error as { originalResponse?: { getBody?: () => string }; message?: string };
              const body = tusError?.originalResponse?.getBody?.();
              if (body) {
                try {
                  const parsed = JSON.parse(body);
                  if (parsed.error) {
                    errorMessage = translateErrorCode(parsed.error);
                  }
                } catch {
                  errorMessage = body;
                }
              }
              setError(`${t("fileshare.file", "File")} ${index + 1}: ${errorMessage}`);
              setLoading(false);
              setUploadProgress(0);
            },
            onProgress: (bytesUploaded, _bytesTotal) => {
              const currentFileProgress = bytesUploaded;
              const overallProgress = bytesUploadedSoFar + currentFileProgress;
              const percent = Math.round((overallProgress / totalSize) * 100);
              setUploadProgress(Math.min(percent, 100));
            },
            onAfterResponse: (_req, res) => {
              const slugHeader = res.getHeader("X-Share-Slug");
              const idHeader = res.getHeader("X-Share-Id");
              if (slugHeader) {
                shareSlug = slugHeader;
              }
              if (idHeader) {
                shareId = idHeader;
              }
            },
            onSuccess: () => {
              completedFiles++;
              uploadNextFile(index + 1);
            },
          });

          upload.start();
        };

        uploadNextFile(0);
      }
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
            ref={(node) => {
              if (node) {
                dirInputRef.current = node;
                node.setAttribute("webkitdirectory", "");
                node.setAttribute("directory", "");
              }
            }}
            type="file"
            onChange={handleDirectorySelect}
            className="hidden"
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

        <ViewLimitSettings
          hasViewLimit={hasViewLimit}
          setHasViewLimit={setHasViewLimit}
          maxViews={maxViews}
          setMaxViews={setMaxViews}
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
          disabled={loading || files.length === 0}
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
