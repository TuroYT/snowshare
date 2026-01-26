"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { QRCodeSVG } from "qrcode.react";
import { Alert, AlertTitle, Snackbar, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { formatBytes, convertFromMB } from "@/lib/formatSize";

const MAX_DAYS_ANON = 7;
const MAX_DAYS_AUTH = 365;

interface FileWithPath {
  file: File;
  relativePath: string;
}

const BulkFileShare: React.FC = () => {
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
  const [qrSize] = useState<number>(150);
  const [allowAnonFileShare, setAllowAnonFileShare] = useState<boolean | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [maxFileSizeAnon, setMaxFileSizeAnon] = useState<number>(2048);
  const [maxFileSizeAuth, setMaxFileSizeAuth] = useState<number>(51200);
  const [useGiBForAnon, setUseGiBForAnon] = useState(false);
  const [useGiBForAuth, setUseGiBForAuth] = useState(false);

  const useGiB = isAuthenticated ? useGiBForAuth : useGiBForAnon;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setAllowAnonFileShare(data.settings?.allowAnonFileShare ?? true);
          if (data.settings?.anoMaxUpload) {
            setMaxFileSizeAnon(data.settings.anoMaxUpload);
          }
          if (data.settings?.authMaxUpload) {
            setMaxFileSizeAuth(data.settings.authMaxUpload);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const fileList: FileWithPath[] = Array.from(selectedFiles).map((file) => ({
        file,
        relativePath: file.name,
      }));
      setFiles((prev) => [...prev, ...fileList]);
    }
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const fileList: FileWithPath[] = Array.from(selectedFiles).map((file) => {
        const fullPath = (file as any).webkitRelativePath || file.name;
        return {
          file,
          relativePath: fullPath,
        };
      });
      setFiles((prev) => [...prev, ...fileList]);
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
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          filePromises.push(traverseFileTree(entry, ""));
        }
      }
    }

    Promise.all(filePromises).then((results) => {
      const allFiles = results.flat();
      setFiles((prev) => [...prev, ...allFiles]);
    });
  };

  const traverseFileTree = async (
    entry: any,
    path: string
  ): Promise<FileWithPath[]> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((file: File) => {
          const relativePath = path + file.name;
          resolve([{ file, relativePath }]);
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        dirReader.readEntries(async (entries: any[]) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (files.length === 0) {
      setError(t("fileshare.file_required", "At least one file is required"));
      return;
    }

    const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
    const maxTotalMB = isAuthenticated ? maxFileSizeAuth : maxFileSizeAnon;
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
    } catch (err) {
      setLoading(false);
      setError(t("fileshare.upload_error", "An error occurred during upload"));
    }
  };

  const getTotalSize = () => {
    return files.reduce((sum, f) => sum + f.file.size, 0);
  };

  const copyToClipboard = () => {
    if (success) {
      navigator.clipboard.writeText(success);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (settingsLoading) {
    return <div>{t("common.loading", "Loading...")}</div>;
  }

  if (!isAuthenticated && allowAnonFileShare === false) {
    return (
      <div className="text-center p-4">
        <Alert severity="info">
          {t(
            "fileshare.auth_required",
            "Please sign in to share files"
          )}
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">
        {t("bulkfileshare.title", "Bulk File Upload")}
      </h2>

      {success ? (
        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4 text-green-800">
            {t("fileshare.success", "Files uploaded successfully!")}
          </h3>
          <div className="mb-4">
            <input
              type="text"
              value={success}
              readOnly
              className="w-full p-2 border rounded"
            />
          </div>
          <button
            onClick={copyToClipboard}
            className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
          >
            {copied
              ? t("fileshare.copied", "Copied!")
              : t("fileshare.copy", "Copy Link")}
          </button>
          <div className="mt-4">
            <QRCodeSVG value={success} size={qrSize} />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div
            className={`border-2 border-dashed rounded-lg p-8 mb-4 text-center ${
              dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <p className="mb-4">
              {t(
                "bulkfileshare.drag_drop",
                "Drag and drop files or folders here"
              )}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                {t("bulkfileshare.select_files", "Select Files")}
              </button>
              <button
                type="button"
                onClick={() => dirInputRef.current?.click()}
                className="bg-green-500 text-white px-4 py-2 rounded"
              >
                {t("bulkfileshare.select_folder", "Select Folder")}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={dirInputRef}
              type="file"
              onChange={handleDirectorySelect}
              className="hidden"
              {...({ webkitdirectory: "", directory: "" } as any)}
            />
          </div>

          {files.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">
                {t("bulkfileshare.selected_files", "Selected Files")} ({files.length})
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                {t("bulkfileshare.total_size", "Total size")}: {formatBytes(getTotalSize(), useGiB)}
              </p>
              <div className="max-h-48 overflow-y-auto border rounded p-2">
                {files.map((fileWithPath, index) => (
                  <div key={index} className="flex justify-between items-center py-1">
                    <span className="text-sm truncate">{fileWithPath.relativePath}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-500 text-sm ml-2"
                    >
                      {t("common.remove", "Remove")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block mb-2">
              {t("fileshare.custom_slug", "Custom URL (optional)")}
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="my-custom-url"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-2">
              {t("fileshare.password", "Password (optional)")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-2">
              {t("fileshare.expires_in", "Expires in (days)")}
            </label>
            <input
              type="number"
              value={expiresDays}
              onChange={(e) => setExpiresDays(Number(e.target.value))}
              min={1}
              max={isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON}
              className="w-full p-2 border rounded"
              disabled={neverExpires}
            />
            {isAuthenticated && (
              <label className="flex items-center mt-2">
                <input
                  type="checkbox"
                  checked={neverExpires}
                  onChange={(e) => setNeverExpires(e.target.checked)}
                  className="mr-2"
                />
                {t("fileshare.never_expires", "Never expires")}
              </label>
            )}
          </div>

          {loading && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-500 h-4 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-center mt-2">{uploadProgress}%</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || files.length === 0}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading
              ? t("fileshare.uploading", "Uploading...")
              : t("bulkfileshare.upload", "Upload Files")}
          </button>
        </form>
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert
          onClose={() => setError(null)}
          severity="error"
          action={
            <IconButton size="small" onClick={() => setError(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          <AlertTitle>{t("common.error", "Error")}</AlertTitle>
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default BulkFileShare;
