"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface AdvancedSettingsProps {
  slug: string;
  setSlug: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  /** URL path prefix for the slug (e.g. "/l/", "/p/", "/f/") */
  slugPrefix: string;
  /** i18n prefix for translation keys (e.g. "linkshare", "fileshare", "pasteshare_ui") */
  translationPrefix: string;
  /** Override the password label i18n key (defaults to translationPrefix.password_protect) */
  passwordLabelKey?: string;
  /** Optional note/description. When both note and setNote are provided, a note field is rendered. */
  note?: string;
  setNote?: (value: string) => void;
}

const MAX_NOTE_LENGTH = 2000;

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  slug,
  setSlug,
  password,
  setPassword,
  slugPrefix,
  translationPrefix,
  passwordLabelKey,
  note,
  setNote,
}) => {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="bg-[var(--surface-hover)] p-4 rounded-[var(--radius)] border border-[var(--border)] space-y-4">
      <h3 className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
          />
        </svg>
        {t(`${translationPrefix}.advanced`, "Paramètres avancés (optionnel)")}
      </h3>

      <div className="space-y-3">
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-[var(--foreground)] mb-2">
            {t(`${translationPrefix}.custom_slug`, "Lien personnalisé")}
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center items-start gap-2">
            <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">
              {origin + slugPrefix}
            </span>
            <input
              id="slug"
              type="text"
              placeholder={t(`${translationPrefix}.placeholder_slug`, "mon-lien-custom")}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              pattern="[a-zA-Z0-9-_]+"
              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 focus:outline-none focus:border-[var(--foreground)] flex-1"
            />
          </div>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {t(
              `${translationPrefix}.slug_hint`,
              "Lettres, chiffres, tirets et underscores uniquement"
            )}
          </p>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-[var(--foreground)] mb-2"
          >
            {t(
              passwordLabelKey || `${translationPrefix}.password_protect`,
              "Protection par mot de passe"
            )}
          </label>
          <div className="relative">
            <input
              id="password"
              type="password"
              placeholder={t(
                `${translationPrefix}.password_placeholder`,
                "Optionnel - laissez vide pour un accès libre"
              )}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 focus:outline-none focus:border-[var(--foreground)] pr-10"
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-5a2 2 0 00-2-2H6a2 2 0 00-2 2v5a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
        </div>

        {setNote && (
          <div>
            <label
              htmlFor="note"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              {t(`${translationPrefix}.note`, "Note")}
            </label>
            <textarea
              id="note"
              rows={3}
              maxLength={MAX_NOTE_LENGTH}
              placeholder={t(
                `${translationPrefix}.note_placeholder`,
                "Optional - add a note or description shown alongside the file"
              )}
              value={note ?? ""}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 focus:outline-none focus:border-[var(--foreground)] resize-y"
            />
            <p className="text-xs text-[var(--foreground-muted)] mt-1 text-right">
              {note?.length ?? 0}/{MAX_NOTE_LENGTH}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedSettings;
