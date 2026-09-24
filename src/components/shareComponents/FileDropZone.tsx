"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { collectDroppedFiles, type FileWithPath } from "@/lib/client/file-drop";

interface FileDropZoneProps {
  files: FileWithPath[];
  setFiles: (files: FileWithPath[]) => void;
  setError: (error: string | null) => void;
  totalSize: number;
  formatFileSize: (bytes: number) => string;
  maxSizeHint: React.ReactNode;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  dirInputRef: React.RefObject<HTMLInputElement | null>;
}

/** Stable key for a file in the removable list: relativePath alone is not
 * guaranteed unique (e.g. two folders dropped with same-named files), so we
 * combine it with size and lastModified. */
function fileKey(f: FileWithPath): string {
  return `${f.relativePath}__${f.file.size}__${f.file.lastModified}`;
}

const FileDropZone: React.FC<FileDropZoneProps> = ({
  files,
  setFiles,
  setError,
  totalSize,
  formatFileSize,
  maxSizeHint,
  fileInputRef,
  dirInputRef,
}) => {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = React.useState(false);

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
        const fullPath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
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

    collectDroppedFiles(items)
      .then((allFiles) => {
        setFiles(allFiles);
        setError(null);
      })
      .catch((error) => {
        console.error("FileDropZone drop handling error:", error);
        setError(t("fileshare.network_error", "Network error — could not create share"));
      });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeFile = (key: string) => {
    setFiles(files.filter((f) => fileKey(f) !== key));
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--foreground)]">
        {t("fileshare.file_selected", "File to share")}&nbsp;
        <span className="text-[var(--destructive)]">*</span>
      </label>

      {files.length === 0 ? (
        <div
          className={`border-2 border-dashed rounded-[var(--radius)] p-6 text-center transition-colors duration-200 ${
            dragOver
              ? "border-[var(--secondary)] bg-[var(--surface-hover)]"
              : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
          }`}
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
                {t("fileshare.or_click", "or click to select")}
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
            <p className="text-xs text-[var(--foreground-muted)]">{maxSizeHint}</p>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--surface)] p-4 rounded-[var(--radius)] border border-[var(--border)]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-[var(--foreground)]">
              {t("fileshare.selected_files", "Selected Files")} ({files.length})
            </h3>
            <p className="text-sm text-[var(--foreground-muted)]">
              {t("fileshare.total_size", "Total")}: {formatFileSize(totalSize)}
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {files.map((fileWithPath) => (
              <div
                key={fileKey(fileWithPath)}
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
                  onClick={() => removeFile(fileKey(fileWithPath))}
                  className="ml-2 text-[var(--destructive)] hover:opacity-80 transition-opacity"
                  title={t("common.remove", "Remove")}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        onChange={handleFileSelect}
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
  );
};

export default FileDropZone;
