"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";
import { collectDroppedFiles, type FileWithPath } from "@/lib/client/file-drop";

interface FileDropZoneProps {
  files: FileWithPath[];
  setFiles: React.Dispatch<React.SetStateAction<FileWithPath[]>>;
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
  const labelId = React.useId();

  /** Adds files to the current selection, skipping the ones already selected. */
  const addFiles = (incoming: FileWithPath[]) => {
    setFiles((current) => {
      const seen = new Set(current.map(fileKey));
      return [...current, ...incoming.filter((f) => !seen.has(fileKey(f)) && seen.add(fileKey(f)))];
    });
    setError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      addFiles(Array.from(selectedFiles).map((file) => ({ file, relativePath: file.name })));
    }
    // Allow picking the same file again after removing it
    e.target.value = "";
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      addFiles(
        Array.from(selectedFiles).map((file) => ({
          file,
          relativePath:
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        }))
      );
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    collectDroppedFiles(items)
      .then(addFiles)
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
    setFiles((current) => current.filter((f) => fileKey(f) !== key));
  };

  const pickerButtons = (primary: boolean) => (
    <div className="flex gap-2 justify-center flex-wrap">
      <Button
        type="button"
        variant={primary ? "primary" : "secondary"}
        className="min-h-11"
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
      >
        {t("fileshare.select_files", "Select Files")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="min-h-11"
        onClick={(e) => {
          e.stopPropagation();
          dirInputRef.current?.click();
        }}
      >
        {t("fileshare.select_folder", "Select Folder")}
      </Button>
    </div>
  );

  return (
    <div className="space-y-2">
      <p id={labelId} className="block text-sm font-medium text-[var(--foreground)]">
        {t("fileshare.file_selected", "File to share")}&nbsp;
        <span className="text-[var(--destructive)]" aria-hidden="true">
          *
        </span>
      </p>

      {files.length === 0 ? (
        <div
          role="group"
          aria-labelledby={labelId}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-[var(--radius)] p-6 text-center transition-colors duration-200 cursor-pointer ${
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
              aria-hidden="true"
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
            {pickerButtons(true)}
            <p className="text-xs text-[var(--foreground-muted)]">{maxSizeHint}</p>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--surface)] p-4 rounded-[var(--radius)] border border-[var(--border)]">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeFile(fileKey(fileWithPath))}
                  aria-label={t("fileshare.remove_file", "Remove {{name}}", {
                    name: fileWithPath.relativePath,
                  })}
                  title={t("common.remove", "Remove")}
                  className="ml-2 min-h-11 min-w-11 p-0 text-[var(--destructive)] hover:text-[var(--destructive)]"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-3">{pickerButtons(false)}</div>
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
