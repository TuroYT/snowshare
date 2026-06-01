"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui";
import ShareAccessLogsModal from "./ShareAccessLogsModal";

type Share = {
  id: string;
  type: "FILE" | "PASTE" | "URL";
  slug: string;
  filePath?: string;
  paste?: string;
  pastelanguage?: string;
  urlOriginal?: string;
  password?: string;
  createdAt: string;
  expiresAt?: string;
  maxViews?: number | null;
  viewCount: number;
  accessCount?: number;
};

type ShareItemProps = {
  share: Share;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<Share>) => void;
};

const TYPE_PREFIX: Record<Share["type"], string> = {
  FILE: "/f/",
  PASTE: "/p/",
  URL: "/l/",
};

export default function ShareItem({ share, onDelete, onUpdate }: ShareItemProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Share>>({
    paste: share.paste,
    pastelanguage: share.pastelanguage,
    urlOriginal: share.urlOriginal,
    password: share.password || "",
    expiresAt: share.expiresAt,
  });

  const path = `${TYPE_PREFIX[share.type]}${share.slug}`;

  const handleDelete = () => {
    if (confirm(t("profile.confirm_delete"))) {
      onDelete(share.id);
    }
  };

  const handleUpdate = () => {
    onUpdate(share.id, editForm);
    setIsEditing(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getTypeIcon = () => {
    switch (share.type) {
      case "FILE":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
      case "PASTE":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        );
      case "URL":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        );
    }
  };

  const getTypeIconClass = () => {
    switch (share.type) {
      case "FILE":
        return "bg-[var(--secondary)]/10 border-[var(--secondary-dark)]/30 text-[var(--secondary)]";
      case "PASTE":
        return "bg-[var(--primary)]/10 border-[var(--primary-dark)]/30 text-[var(--primary)]";
      case "URL":
        return "bg-emerald-500/10 border-emerald-700/30 text-emerald-400";
    }
  };

  const isExpired = !!share.expiresAt && new Date(share.expiresAt) < new Date();
  const isViewLimitReached =
    share.maxViews !== null && share.maxViews !== undefined && share.viewCount >= share.maxViews;

  const iconBtn =
    "p-2 rounded-[var(--radius)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors";

  return (
    <div
      className={`bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--border)] transition-colors hover:border-[var(--border-hover)] ${
        isExpired ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start gap-3 p-4 sm:p-5">
        {/* Type icon */}
        <div
          className={`mt-0.5 h-9 w-9 rounded-[var(--radius)] border flex items-center justify-center flex-shrink-0 ${getTypeIconClass()}`}
        >
          {getTypeIcon()}
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Slug + badges */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              href={path}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-[var(--foreground)] hover:text-[var(--primary)] transition-colors truncate"
            >
              {path}
            </a>
            <button
              onClick={copyToClipboard}
              className={iconBtn + " !p-1"}
              title={t("profile.copy_link")}
              aria-label={t("profile.copy_link")}
            >
              {copied ? (
                <svg
                  className="w-3.5 h-3.5 text-[var(--success)]"
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
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>
            {isExpired && <Badge variant="danger">{t("profile.stats_expired", "Expired")}</Badge>}
            {isViewLimitReached && !isExpired && (
              <Badge variant="danger">
                {t("profile.view_limit_reached", "View Limit Reached")}
              </Badge>
            )}
            {share.password && (
              <Badge variant="warning">{t("profile.protected", "Protected")}</Badge>
            )}
          </div>

          {/* Target preview */}
          <div className="mt-1.5 text-sm text-[var(--foreground-muted)] truncate">
            {share.type === "FILE" && share.filePath && (
              <span>{share.filePath.split("_").slice(1).join("_")}</span>
            )}
            {share.type === "PASTE" && (
              <span className="font-mono text-xs">{share.paste?.substring(0, 100)}</span>
            )}
            {share.type === "URL" && <span>{share.urlOriginal}</span>}
          </div>

          {/* Meta line */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--foreground-muted)]">
            <span>
              {t("profile.created_on")} {new Date(share.createdAt).toLocaleDateString()}
            </span>
            <span className="text-[var(--border)]">·</span>
            <button
              onClick={() => setShowLogs(true)}
              className="hover:text-[var(--foreground)] transition-colors underline-offset-2 hover:underline"
            >
              {t("profile.access_count", "{{count}} accesses", { count: share.accessCount ?? 0 })}
            </button>
            {share.maxViews != null && (
              <>
                <span className="text-[var(--border)]">·</span>
                <span className={isViewLimitReached ? "text-[var(--destructive)]" : ""}>
                  {share.viewCount}/{share.maxViews} {t("profile.views")}
                </span>
              </>
            )}
            {share.expiresAt && (
              <>
                <span className="text-[var(--border)]">·</span>
                <span className={isExpired ? "text-[var(--destructive)]" : ""}>
                  {isExpired ? t("profile.stats_expired", "Expired") : t("profile.expires_on")}{" "}
                  {new Date(share.expiresAt).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => setShowLogs(true)}
              className={iconBtn}
              title={t("profile.view_logs", "View access logs")}
              aria-label={t("profile.view_logs", "View access logs")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </button>
            {share.type !== "FILE" && (
              <button
                onClick={() => setIsEditing(true)}
                className={iconBtn}
                title={t("profile.edit")}
                aria-label={t("profile.edit")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-2 rounded-[var(--radius)] text-[var(--foreground-muted)] hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors"
              title={t("profile.delete")}
              aria-label={t("profile.delete")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Edit form */}
      {isEditing && (
        <div className="space-y-4 border-t border-[var(--border)] p-4 sm:p-5">
          {share.type === "PASTE" && (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  {t("profile.label_content")}
                </label>
                <textarea
                  value={editForm.paste || ""}
                  onChange={(e) => setEditForm({ ...editForm, paste: e.target.value })}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--primary)] font-mono"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  {t("profile.label_language")}
                </label>
                <select
                  value={editForm.pastelanguage || "PLAINTEXT"}
                  onChange={(e) => setEditForm({ ...editForm, pastelanguage: e.target.value })}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--primary)] appearance-none"
                >
                  <option value="PLAINTEXT">Plain Text</option>
                  <option value="JAVASCRIPT">JavaScript</option>
                  <option value="TYPESCRIPT">TypeScript</option>
                  <option value="PYTHON">Python</option>
                  <option value="JAVA">Java</option>
                  <option value="PHP">PHP</option>
                  <option value="GO">Go</option>
                  <option value="POWERSHELL">PowerShell</option>
                  <option value="HTML">HTML</option>
                  <option value="CSS">CSS</option>
                  <option value="SQL">SQL</option>
                  <option value="JSON">JSON</option>
                  <option value="MARKDOWN">Markdown</option>
                </select>
              </div>
            </>
          )}

          {share.type === "URL" && (
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                {t("profile.label_url")}
              </label>
              <input
                type="url"
                value={editForm.urlOriginal || ""}
                onChange={(e) => setEditForm({ ...editForm, urlOriginal: e.target.value })}
                className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              {t("profile.label_password")}
            </label>
            <input
              type="text"
              value={editForm.password || ""}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--primary)]"
              placeholder={t("profile.placeholder_password_optional")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              {t("profile.label_expiration")}
            </label>
            <input
              type="datetime-local"
              value={
                editForm.expiresAt ? new Date(editForm.expiresAt).toISOString().slice(0, 16) : ""
              }
              onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
              className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleUpdate}
              className="px-4 py-2 rounded-[var(--radius)] text-sm font-medium text-white transition-colors flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
            >
              {t("profile.save")}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-[var(--radius)] text-sm border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors flex-1"
            >
              {t("profile.cancel")}
            </button>
          </div>
        </div>
      )}

      <ShareAccessLogsModal
        shareId={share.id}
        slug={share.slug}
        isOpen={showLogs}
        onClose={() => setShowLogs(false)}
      />
    </div>
  );
}
