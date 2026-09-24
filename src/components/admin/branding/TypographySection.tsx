"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AVAILABLE_FONTS } from "@/contexts/ThemeContext";

interface TypographySectionProps {
  fontFamily: string;
  onChange: (key: "fontFamily", value: string) => void;
}

export default function TypographySection({ fontFamily, onChange }: TypographySectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-amber-600/20 border border-amber-700/50 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h8m-8 6h16"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          {t("admin.branding.section_typography")}
        </h3>
      </div>

      <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
        <label className="text-sm text-[var(--foreground)] block mb-2">
          {t("admin.branding.font_family")}
        </label>
        <select
          value={fontFamily}
          onChange={(e) => onChange("fontFamily", e.target.value)}
          className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          {AVAILABLE_FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          {t("admin.branding.font_family_hint")}
        </p>

        {/* Font Preview */}
        <div className="mt-4 p-4 bg-[var(--surface)]/50 rounded-lg border border-[var(--border)]/50">
          <p className="text-xs text-[var(--foreground-muted)] mb-2">
            {t("admin.branding.preview")}
          </p>
          <FontPreview fontFamily={fontFamily} />
        </div>
      </div>
    </div>
  );
}

// Font preview component
function FontPreview({ fontFamily }: { fontFamily: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (fontFamily === "Geist") {
      setLoaded(true);
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;600;700&display=swap`;
    link.onload = () => setLoaded(true);
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [fontFamily]);

  const style: React.CSSProperties = {
    fontFamily: fontFamily === "Geist" ? "var(--font-geist-sans)" : `"${fontFamily}", sans-serif`,
    opacity: loaded ? 1 : 0.5,
    transition: "opacity 0.3s ease",
  };

  return (
    <div style={style} className="space-y-2">
      <p className="text-lg font-bold text-[var(--foreground)]">
        {fontFamily} — The quick brown fox jumps over the lazy dog
      </p>
      <p className="text-sm text-[var(--foreground-muted)]">
        ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
      </p>
      <div className="flex gap-4 text-sm text-[var(--foreground)]">
        <span className="font-light">Light</span>
        <span className="font-normal">Regular</span>
        <span className="font-medium">Medium</span>
        <span className="font-semibold">Semibold</span>
        <span className="font-bold">Bold</span>
      </div>
    </div>
  );
}
