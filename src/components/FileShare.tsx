"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { QRCodeSVG } from "qrcode.react";

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
  const [expiresDays, setExpiresDays] = useState<number>(isAuthenticated ? 30 : MAX_DAYS_ANON);
  const [neverExpires, setNeverExpires] = useState(false);
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState<number>(150);

  const maxFileSize = isAuthenticated ? MAX_FILE_SIZE_AUTH : MAX_FILE_SIZE_ANON;


  
  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
      return t("fileshare.file_too_large", "File is too large (max {{max}}MB)", { max: maxSizeMB });
    }
    return null;
  };

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setFile(selectedFile);
    setError(null);
  };

  // Drag and drop handlers
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

  // File input change handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
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
    if (isAuthenticated && neverExpires) return t("fileshare.duration_never", "This file will never expire");
    if (days === 1) return t("fileshare.duration_in_1_day", "This file will expire in 1 day");
    if (days < 7) return t("fileshare.duration_in_x_days", "This file will expire in {{count}} days", { count: days });
    if (days === 7) return t("fileshare.duration_in_1_week", "This file will expire in 1 week");
    if (days < 30)
      return t("fileshare.duration_in_x_weeks", "This file will expire in {{count}} weeks", {
        count: Math.round(days / 7)
      });
    if (days === 30) return t("fileshare.duration_in_1_month", "This file will expire in 1 month");
    if (days < 365)
      return t("fileshare.duration_in_x_months", "This file will expire in {{count}} months", {
        count: Math.round(days / 30)
      });
    return t("fileshare.duration_in_x_years", "This file will expire in {{count}} year(s)", {
      count: Math.round(days / 365)
    });
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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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
      const formData = new FormData();
      formData.append("type", "FILE");
      formData.append("file", file);

      // Add optional parameters
      if (!isAuthenticated || !neverExpires) {
        const cap = isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON;
        const days = Math.max(1, Math.min(Number(expiresDays) || 1, cap));
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        formData.append("expiresAt", expiresAt);
      }
      
      if (slug.trim()) formData.append("slug", slug.trim());
      if (password.trim()) formData.append("password", password.trim());

      // Create XMLHttpRequest for upload progress
      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise<{ share?: { fileShare?: { slug?: string; id?: string } }; error?: string }>((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));
        
        xhr.open("POST", "/api/shares");
        xhr.send(formData);
      });

      const data = await uploadPromise;
      
      if (data.error) {
        setError(data.error);
      } else {
        const fileShare = data?.share?.fileShare;
        if (fileShare?.slug) {
          setSuccess(`${window.location.origin}/f/${fileShare.slug}`);
        } else if (fileShare?.id) {
          setSuccess(`${window.location.origin}/f/${fileShare.id}`);
        } else {
          setSuccess(t("fileshare.success_title", "File shared successfully!"));
        }
        
        // Reset form
        setFile(null);
        setSlug("");
        setPassword("");
        setNeverExpires(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error("FileShare error:", error);
      setError(t("fileshare.network_error", "Network error — could not create share"));
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="modern-card p-8 w-full max-w-2xl mx-auto text-center">
        <h2 className="text-lg font-semibold text-gray-100 mb-2">
          {t("fileshare.locked_title", "File sharing is locked")}
        </h2>
        <p className="text-gray-400 mb-4">
          {t("fileshare.locked_message", "You must be logged in to share files.")}
        </p>
        {/* Optionally, add a login button or link */}
      </div>
    );
  }

  return (
    <div className="modern-card p-8 w-full max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="modern-icon-purple">
          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">{t("fileshare.title", "Partager un fichier")}</h2>
          <p className="text-sm text-gray-400">
            {t("fileshare.subtitle", "Uploadez et partagez vos fichiers facilement")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload Area */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {t("fileshare.file_selected", "File to share")}&nbsp;<span className="text-red-400">*</span>
          </label>
          
          {!file ? (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                dragOver
                  ? "border-purple-400 bg-purple-900/20 scale-105"
                  : "border-gray-600/50 hover:border-gray-500 hover:bg-gray-800/30 hover:scale-102"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
                <div>
                  <p className="text-gray-300 font-medium">
                    {t("fileshare.drag_drop", "Drag & drop your file here")}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {t("fileshare.click_to_select", "or click to select a file")}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  {isAuthenticated
                    ? t("fileshare.max_size_auth", "500MB maximum for authenticated users")
                    : t("fileshare.max_size_anon", "50MB maximum for anonymous users")}
                </p>
              </div>
            </div>
          ) : (
            <div className="modern-section p-4">
              <div className="flex items-start gap-3">
                <svg className="w-8 h-8 text-purple-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 mb-1">
                    {t("fileshare.file_selected", "Selected file:")}
                  </p>
                  <p className="text-sm text-gray-300 truncate">{file.name}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    <span>{t("fileshare.file_size", "Size:")}&nbsp;{formatFileSize(file.size)}</span>
                    <span>{t("fileshare.file_type", "Type:")}&nbsp;{file.type || "Unknown"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-gray-400 hover:text-white hover:bg-gray-700 rounded p-1 transition-colors"
                  title={t("fileshare.change_file", "Change file")}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
            <div className="flex justify-between text-sm text-gray-300">
              <span>{t("fileshare.uploading", "Uploading...")}</span>
              <span>{t("fileshare.upload_progress", "Progress: {{progress}}%", { progress: uploadProgress })}</span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full transition-all duration-300 shadow-lg shadow-purple-500/25"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Expiration Settings */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            {t("fileshare.validity_label", "Validity duration")}
          </label>

          {isAuthenticated && (
            <div className="modern-section p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={neverExpires}
                  onChange={(e) => setNeverExpires(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-2 focus:ring-offset-0"
                />
                <div>
                  <div className="text-sm font-medium text-gray-200">
                    {t("fileshare.never_expires", "Never expires")}
                  </div>
                  <div className="text-xs text-gray-400">
                    {t("fileshare.never_expires_desc", "This file will remain available indefinitely")}
                  </div>
                </div>
              </label>
            </div>
          )}

          <div className={`flex items-center gap-3 ${isAuthenticated && neverExpires ? "opacity-50" : ""}`}>
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
            <span className="text-sm text-gray-400 min-w-0">{t("fileshare.days", "days")}</span>
          </div>

          <div className="text-xs text-gray-400 modern-section p-3">
            <div className="flex items-center gap-2">
              <svg
                className="w-3 h-3 text-purple-400 flex-shrink-0"
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
            <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded p-2">
              💡{" "}
              {t(
                "fileshare.login_for_more",
                "Log in for longer durations (up to {{max}} days) or no expiration and larger files (up to 500MB)",
                { max: MAX_DAYS_AUTH }
              )}
            </p>
          )}
        </div>

        {/* Advanced Settings */}
        <div className="modern-section p-6 space-y-4">
          <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <label htmlFor="slug" className="block text-sm font-medium text-gray-300 mb-2">
                {t("fileshare.custom_slug", "Custom link")}
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center items-center gap-2">
                <span className="text-sm text-gray-400 whitespace-nowrap">
                  {typeof window !== "undefined" ? window.location.origin + "/f/" : "/f/"}
                </span>
                <input
                  id="slug"
                  type="text"
                  placeholder={t("fileshare.placeholder_slug", "mon-fichier-custom")}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  pattern="[a-zA-Z0-9-_]+"
                  className="modern-input flex-1"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {t("fileshare.slug_hint", "Letters, numbers, dashes and underscores only")}
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                {t("fileshare.password_protect", "Password protection")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  placeholder={t("fileshare.password_placeholder", "Optionnel - laissez vide pour un accès libre")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="modern-input w-full pr-12"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            disabled={loading || !file}
            className="btn-paste w-full inline-flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {error && (
        <div role="alert" className="mt-6 bg-red-900/20 border border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-red-300 mb-1">{t("fileshare.error_title", "Error")}</h4>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div role="status" className="mt-6 bg-green-900/20 border border-green-800 rounded-lg p-4">
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
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-1">{t("fileshare.download_link", "Download link:")}</p>
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
                    className="p-3 text-gray-400 hover:text-purple-400 hover:bg-gray-700/50 rounded-lg transition-all duration-200 hover:scale-110"
                    title={t("fileshare.copy_title", "Copier le lien")}
                  >
                    {copied ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="flex flex-col items-center modern-section p-4">
                  <p className="text-sm text-gray-300 mb-2 text-center">
                    {t("fileshare.qr_info", "Scan this QR code to download the file")}
                  </p>
                  <div className="bg-white rounded p-2" style={{ width: qrSize, height: qrSize }}>
                    <QRCodeSVG value={success} size={qrSize - 16} className="block" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .input-paste {
          border: 1px solid rgba(75, 85, 99, 0.5);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          background: rgba(31, 41, 55, 0.5);
          color: #f3f4f6;
          transition: all 0.2s ease;
        }
        .input-paste:focus {
          outline: none;
          border-color: #8b5cf6;
          background: rgba(17, 24, 39, 0.5);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }
        .input-paste::placeholder {
          color: #9ca3af;
          opacity: 1;
        }
        .btn-paste {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          color: #fff;
          border-radius: 0.75rem;
          font-weight: 600;
          box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.25);
          transition: all 0.3s ease;
        }
        .btn-paste:hover:not(:disabled) {
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px 0 rgba(59, 130, 246, 0.4);
        }
        label {
          color: #f3f4f6;
          font-weight: 500;
        }
        .hover\:scale-102:hover {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
};

export default FileShare;
