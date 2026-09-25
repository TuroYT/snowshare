"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  MAX_ANON_EXPIRY_DAYS,
} from "@/lib/share-constants";
import { useShareForm } from "@/hooks/useShareForm";
import { useTusUpload } from "@/hooks/useTusUpload";
import { formatBytes, convertFromMB } from "@/lib/formatSize";
import type { FileWithPath } from "@/lib/client/file-drop";
import LockedShare from "./shareComponents/LockedShare";
import ExpirationSettings from "./shareComponents/ExpirationSettings";
import AdvancedSettings from "./shareComponents/AdvancedSettings";
import ViewLimitSettings from "./shareComponents/ViewLimitSettings";
import ShareSuccess from "./shareComponents/ShareSuccess";
import ShareError from "./shareComponents/ShareError";
import SubmitButton from "./shareComponents/SubmitButton";
import FileDropZone from "./shareComponents/FileDropZone";

const MAX_DAYS_ANON = MAX_ANON_EXPIRY_DAYS;
const MAX_NOTE_LENGTH = 2000;

interface FileShareProps {
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
}

const FileShare: React.FC<FileShareProps> = ({ initialFiles, onInitialFilesConsumed }) => {
  const { t, i18n } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [note, setNote] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const {
    isAuthenticated,
    shareSettings: {
      allowAnonFileShare,
      anoMaxUploadBytes: maxFileSizeAnon,
      authMaxUploadBytes: maxFileSizeAuth,
      useGiBForAnon,
      useGiBForAuth,
      loading: settingsLoading,
    },
    formRef,
    slug,
    setSlug,
    password,
    setPassword,
    neverExpires,
    setNeverExpires,
    expiresDays,
    setExpiresDays,
    hasViewLimit,
    setHasViewLimit,
    maxViews,
    setMaxViews,
    loading,
    setLoading,
    error,
    setError,
    success,
    setSuccess,
    successSlug,
    setSuccessSlug,
    computeExpiresAt,
    resetAfterSuccess,
  } = useShareForm({ canSubmit: () => files.length > 0 });

  const { startUpload } = useTusUpload();

  // Load files pasted from the clipboard (Ctrl+V on the home page)
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setFiles(initialFiles.map((file) => ({ file, relativePath: file.name })));
      setError(null);
      onInitialFilesConsumed?.();
    }
  }, [initialFiles, onInitialFilesConsumed, setError]);

  const maxFileSize = isAuthenticated ? maxFileSizeAuth : maxFileSizeAnon;
  const useGiB = isAuthenticated ? useGiBForAuth : useGiBForAnon;

  const formatFileSize = (bytes: number): string => {
    return formatBytes(bytes, useGiB);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      const maxValue = convertFromMB(Math.round(maxFileSize / (1024 * 1024)), useGiB);
      const unit = useGiB ? "GiB" : "MiB";
      return t("fileshare.file_too_large", "File is too large (max {{max}} {{unit}})", {
        max: maxValue,
        unit,
      });
    }
    return null;
  };

  const totalSize = React.useMemo(() => files.reduce((sum, f) => sum + f.file.size, 0), [files]);

  // Map server error codes to translated messages
  const errorCodeMap: Record<string, string> = {
    SLUG_ALREADY_TAKEN: t(
      "api.errors.slug_already_taken",
      "This custom URL is already taken. Please choose another one."
    ),
    SLUG_INVALID: t(
      "api.errors.slug_invalid",
      "Invalid slug. It must contain between 3 and 30 alphanumeric characters, dashes or underscores."
    ),
    IP_QUOTA_EXCEEDED: t("fileshare.upload_ip_quota_exceeded", "IP quota exceeded."),
    FILE_TOO_LARGE: t("fileshare.upload_file_too_large", "File size exceeds the allowed limit."),
  };

  const translateErrorCode = (code: string): string => {
    if (errorCodeMap[code]) return errorCodeMap[code];
    // Any other server error code has a generic translation under api.errors.*
    const key = `api.errors.${code.toLowerCase()}`;
    return i18n.exists(key)
      ? t(key, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH, days: MAX_DAYS_ANON })
      : code;
  };

  const finishAndReset = (shareSlug: string | null, progress: number) => {
    if (shareSlug) {
      setSuccess(`${window.location.origin}/f/${shareSlug}`);
      setSuccessSlug(shareSlug);
    }
    setFiles([]);
    resetAfterSuccess();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setLoading(false);
    setUploadProgress(progress);
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

    const maxTotalMB = isAuthenticated
      ? maxFileSizeAuth / (1024 * 1024)
      : maxFileSizeAnon / (1024 * 1024);
    const maxTotalBytes = maxTotalMB * 1024 * 1024;

    if (totalSize > maxTotalBytes) {
      const maxValue = convertFromMB(maxTotalMB, useGiB);
      const unit = useGiB ? "GiB" : "MiB";
      setError(
        t("fileshare.total_size_too_large", "Total size exceeds limit (max {{max}} {{unit}})", {
          max: maxValue,
          unit,
        })
      );
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    const networkErrorMessage = t(
      "fileshare.network_error",
      "Network error — could not create share"
    );

    try {
      const baseMetadata: Record<string, string> = {};

      const expiresAt = computeExpiresAt();
      if (expiresAt) baseMetadata.expiresAt = expiresAt;

      if (slug.trim()) baseMetadata.slug = slug.trim();
      if (password.trim()) baseMetadata.password = password.trim();
      if (note.trim()) baseMetadata.note = note.trim().slice(0, MAX_NOTE_LENGTH);
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

        await startUpload({
          file,
          metadata,
          translateErrorCode,
          networkErrorMessage,
          onProgress: (bytesUploaded, bytesTotal) => {
            const total = bytesTotal || file.size;
            if (total > 0) {
              const percent = Math.round((bytesUploaded / total) * 100);
              setUploadProgress(percent);
            }
          },
          onAfterResponse: (headers) => {
            if (headers.shareSlug) {
              shareSlug = headers.shareSlug;
            }
          },
          onSuccess: () => {
            if (!shareSlug) {
              setError(networkErrorMessage);
              setLoading(false);
              setUploadProgress(0);
              return;
            }
            finishAndReset(shareSlug, 0);
          },
          onError: (message) => {
            setError(message);
            setLoading(false);
            setUploadProgress(0);
          },
        });
      } else {
        let shareSlug: string | null = null;
        let shareId: string | null = null;

        const uploadNextFile = async (index: number): Promise<void> => {
          if (index >= files.length) {
            finishAndReset(shareSlug, 100);
            return;
          }

          const fileWithPath = files[index];
          const file = fileWithPath.file;

          const metadata: Record<string, string> = {
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

          let bytesUploadedSoFar = 0;
          for (let i = 0; i < index; i++) {
            bytesUploadedSoFar += files[i].file.size;
          }

          let fileProcessed = false;
          let fileErrored = false;

          await startUpload({
            file,
            metadata,
            translateErrorCode,
            networkErrorMessage,
            onProgress: (bytesUploaded) => {
              const overallProgress = bytesUploadedSoFar + bytesUploaded;
              const percent = Math.round((overallProgress / totalSize) * 100);
              setUploadProgress(Math.min(percent, 100));
            },
            onAfterResponse: (headers) => {
              if (headers.shareSlug) {
                shareSlug = headers.shareSlug;
                fileProcessed = true;
              }
              if (headers.shareId) {
                shareId = headers.shareId;
              }
            },
            onSuccess: () => {
              if (!fileProcessed) {
                setError(`${t("fileshare.file", "File")} ${index + 1}: ${networkErrorMessage}`);
                setLoading(false);
                setUploadProgress(0);
              }
            },
            onError: (message) => {
              fileErrored = true;
              setError(`${t("fileshare.file", "File")} ${index + 1}: ${message}`);
              setLoading(false);
              setUploadProgress(0);
            },
          });

          if (fileProcessed && !fileErrored) {
            await uploadNextFile(index + 1);
          }
        };

        await uploadNextFile(0);
      }
    } catch (error) {
      console.error("FileShare error:", error);
      if (error instanceof Error && error.message) {
        setError(error.message);
      } else {
        setError(networkErrorMessage);
      }
      setLoading(false);
      setUploadProgress(0);
    }
  };

  if (!isAuthenticated && (settingsLoading || !allowAnonFileShare)) {
    return <LockedShare type="file" isLoading={settingsLoading} isLocked={!allowAnonFileShare} />;
  }

  const maxSizeHint = isAuthenticated
    ? t("fileshare.max_size_auth", "{{max}} {{unit}} maximum for authenticated users", {
        max: convertFromMB(Math.round(maxFileSizeAuth / (1024 * 1024)), useGiB),
        unit: useGiB ? "GiB" : "MiB",
      })
    : t("fileshare.max_size_anon", "{{max}} {{unit}} maximum for anonymous users", {
        max: convertFromMB(Math.round(maxFileSizeAnon / (1024 * 1024)), useGiB),
        unit: useGiB ? "GiB" : "MiB",
      });

  return (
    <div className="bg-[var(--surface)] p-6 rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] border border-[var(--border)] w-full max-w-2xl mx-auto text-left">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-center">
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
            {t("fileshare.title", "Share a file")}
          </h2>
          <p className="text-sm text-[var(--foreground-muted)]">
            {t("fileshare.subtitle", "Upload and share your files securely")}
          </p>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        <FileDropZone
          files={files}
          setFiles={setFiles}
          setError={setError}
          totalSize={totalSize}
          formatFileSize={formatFileSize}
          maxSizeHint={maxSizeHint}
          fileInputRef={fileInputRef}
          dirInputRef={dirInputRef}
        />

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
            <div className="w-full bg-[var(--surface)] rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${uploadProgress}%`,
                  background: "var(--primary)",
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
          loginForMoreParams={{
            maxSize: convertFromMB(maxFileSizeAuth / (1024 * 1024), useGiBForAuth),
            unit: useGiBForAuth ? "GiB" : "MiB",
          }}
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
          note={note}
          setNote={setNote}
        />

        <SubmitButton
          loading={loading}
          disabled={loading || files.length === 0}
          loadingText={t("fileshare.creating", "Creating...")}
          submitText={t("fileshare.submit", "Share file")}
          iconPath="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </form>

      {error && <ShareError error={error} translationPrefix="fileshare" />}

      {success && <ShareSuccess url={success} slug={successSlug} translationPrefix="fileshare" />}
    </div>
  );
};

export default FileShare;
