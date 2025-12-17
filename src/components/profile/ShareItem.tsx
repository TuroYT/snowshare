"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";

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
};

type ShareItemProps = {
  share: Share;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<Share>) => void;
};

export default function ShareItem({ share, onDelete, onUpdate }: ShareItemProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Share>>({
    paste: share.paste,
    pastelanguage: share.pastelanguage,
    urlOriginal: share.urlOriginal,
    password: share.password || "",
    expiresAt: share.expiresAt,
  });

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
    const baseUrl = window.location.origin;
    let url = "";

    switch (share.type) {
      case "FILE":
        url = `${baseUrl}/f/${share.slug}`;
        break;
      case "PASTE":
        url = `${baseUrl}/p/${share.slug}`;
        break;
      case "URL":
        url = `${baseUrl}/l/${share.slug}`;
        break;
    }

    navigator.clipboard.writeText(url);
  };

  const getTypeIcon = () => {
    switch (share.type) {
      case "FILE":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
      case "PASTE":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        );
      case "URL":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        );
    }
  };

  const getTypeColor = () => {
    switch (share.type) {
      case "FILE":
        return "from-purple-600/20 to-purple-800/20 border-[var(--secondary-dark)]/50 text-[var(--secondary)]";
      case "PASTE":
        return "from-blue-600/20 to-blue-800/20 border-[var(--primary-dark)]/50 text-[var(--primary)]";
      case "URL":
        return "from-green-600/20 to-green-800/20 border-green-700/50 text-green-400";
    }
  };

  const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();

  return (
    <div className={`modern-card p-6 ${isExpired ? 'opacity-60 border-red-900/30' : ''}`}>
      <div className="flex flex-col md:flex-row gap-4">
        {/* Icon and Type */}
        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br border flex items-center justify-center flex-shrink-0 ${isExpired ? 'from-red-600/20 to-red-800/20 border-red-700/50 text-red-400' : getTypeColor()}`}>
          {getTypeIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${isExpired ? 'from-red-600/20 to-red-800/20 border-red-700/50 text-red-400' : getTypeColor()}`}>
              {share.type}
            </span>
            {isExpired && (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-900/30 border border-red-700/50 text-red-400">
                {t("profile.stats_expired", "Expired")}
              </span>
            )}
            <span className="text-[var(--foreground-muted)] text-sm">
              {t("profile.created_on")} {new Date(share.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="mb-3">
            <button
              onClick={copyToClipboard}
              className="group flex items-center gap-2 text-[var(--primary)] hover:text-[var(--primary-hover)] font-mono text-sm transition-colors"
              title={t("profile.copy_link")}
            >
                <span>
            {(() => {
                switch (share.type) {
                    case "FILE":
                        return <a href={`/f/${share.slug}`} target="_blank" rel="noopener noreferrer">/f/{share.slug}</a>;
                    case "PASTE":
                        return <a href={`/p/${share.slug}`} target="_blank" rel="noopener noreferrer">/p/{share.slug}</a>;
                    case "URL":
                        return <a href={`/l/${share.slug}`} target="_blank" rel="noopener noreferrer">/l/{share.slug}</a>;
                }
            })()}</span>
              <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>

          {isEditing ? (
            <div className="space-y-4 border-t border-[var(--border)] pt-4">
              {share.type === "PASTE" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">{t("profile.label_content")}</label>
                    <textarea
                      value={editForm.paste || ""}
                      onChange={(e) => setEditForm({ ...editForm, paste: e.target.value })}
                      className="modern-input w-full font-mono text-sm"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">{t("profile.label_language")}</label>
                    <select
                      value={editForm.pastelanguage || "PLAINTEXT"}
                      onChange={(e) => setEditForm({ ...editForm, pastelanguage: e.target.value })}
                      className="modern-input w-full"
                    >
                      <option value="PLAINTEXT">Plain Text</option>
                      <option value="JAVASCRIPT">JavaScript</option>
                      <option value="TYPESCRIPT">TypeScript</option>
                      <option value="PYTHON">Python</option>
                      <option value="JAVA">Java</option>
                      <option value="HTML">HTML</option>
                      <option value="CSS">CSS</option>
                      <option value="JSON">JSON</option>
                      <option value="MARKDOWN">Markdown</option>
                    </select>
                  </div>
                </>
              )}

              {share.type === "URL" && (
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">{t("profile.label_url")}</label>
                  <input
                    type="url"
                    value={editForm.urlOriginal || ""}
                    onChange={(e) => setEditForm({ ...editForm, urlOriginal: e.target.value })}
                    className="modern-input w-full"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">{t("profile.label_password")}</label>
                <input
                  type="text"
                  value={editForm.password || ""}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="modern-input w-full"
                  placeholder={t("profile.placeholder_password_optional")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">{t("profile.label_expiration")}</label>
                <input
                  type="datetime-local"
                  value={editForm.expiresAt ? new Date(editForm.expiresAt).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
                  className="modern-input w-full"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleUpdate} className="modern-button modern-button-primary flex-1">
                  {t("profile.save")}
                </button>
                <button onClick={() => setIsEditing(false)} className="modern-button modern-button-secondary flex-1">
                  {t("profile.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <>
              {share.type === "FILE" && share.filePath && (
                <p className="text-[var(--foreground)] text-sm truncate">📄 {share.filePath.split("_").slice(1).join("_")}</p>
              )}
              {share.type === "PASTE" && (
                <div className="modern-section p-3">
                  <p className="text-[var(--foreground)] font-mono text-xs truncate">{share.paste?.substring(0, 100)}...</p>
                </div>
              )}
              {share.type === "URL" && (
                <p className="text-[var(--foreground)] text-sm truncate">→ {share.urlOriginal}</p>
              )}

              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                {share.expiresAt && (
                  <span className={`px-2 py-1 rounded ${
                    isExpired 
                      ? 'bg-red-900/30 border border-red-800 text-red-400' 
                      : 'bg-yellow-900/20 border border-yellow-800 text-yellow-400'
                  }`}>
                    {isExpired ? '⛔' : '⏰'} {isExpired ? t("profile.stats_expired", "Expired") : t("profile.expires_on")} {new Date(share.expiresAt).toLocaleDateString()}
                  </span>
                )}
                {share.password && (
                  <span className="px-2 py-1 bg-orange-900/20 border border-orange-800 text-orange-400 rounded">
                    🔒 {t("profile.protected")}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="flex md:flex-col gap-2 flex-shrink-0">
            {share.type !== "FILE" && (
              <button 
                onClick={() => setIsEditing(true)} 
                className="modern-button modern-button-secondary px-4 py-2 text-sm"
                title={t("profile.edit")}
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
              className="modern-button modern-button-secondary px-4 py-2 text-sm hover:bg-red-900/30 hover:border-red-700 hover:text-red-400"
              title={t("profile.delete")}
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
    </div>
  );
}
