"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FIELD_FOCUS } from "./fieldStyles";

interface AdvancedSettingsProps {
  slug: string;
  setSlug: (value: string) => void;
  /** URL path prefix for the slug (e.g. "/l/", "/p/", "/f/") */
  slugPrefix: string;
  /** i18n prefix for translation keys (e.g. "linkshare", "fileshare", "pasteshare_ui") */
  translationPrefix: string;
  /** Optional note/description. When both note and setNote are provided, a note field is rendered. */
  note?: string;
  setNote?: (value: string) => void;
}

const MAX_NOTE_LENGTH = 2000;

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  slug,
  setSlug,
  slugPrefix,
  translationPrefix,
  note,
  setNote,
}) => {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState("");
  const slugId = React.useId();
  const noteId = React.useId();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={slugId} className="block text-sm font-medium text-[var(--foreground)] mb-2">
          {t(`${translationPrefix}.custom_slug`, "Custom link")}
        </label>
        <div className="flex flex-col sm:flex-row sm:items-center items-start gap-2">
          <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">
            {origin + slugPrefix}
          </span>
          <input
            id={slugId}
            type="text"
            placeholder={t(`${translationPrefix}.placeholder_slug`, "my-custom-link")}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            pattern="[a-zA-Z0-9-_]+"
            className={`w-full bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 ${FIELD_FOCUS} flex-1`}
          />
        </div>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          {t(`${translationPrefix}.slug_hint`, "Letters, numbers, dashes and underscores only")}
        </p>
      </div>

      {setNote && (
        <div>
          <label
            htmlFor={noteId}
            className="block text-sm font-medium text-[var(--foreground)] mb-2"
          >
            {t(`${translationPrefix}.note`, "Note")}
          </label>
          <textarea
            id={noteId}
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            placeholder={t(
              `${translationPrefix}.note_placeholder`,
              "Optional - add a note or description shown alongside the file"
            )}
            value={note ?? ""}
            onChange={(e) => setNote(e.target.value)}
            className={`w-full bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] px-3 py-2 ${FIELD_FOCUS} resize-y`}
          />
          <p className="text-xs text-[var(--foreground-muted)] mt-1 text-right">
            {note?.length ?? 0}/{MAX_NOTE_LENGTH}
          </p>
        </div>
      )}
    </div>
  );
};

export default AdvancedSettings;
