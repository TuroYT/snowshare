"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui";
import { AVAILABLE_FONTS } from "@/contexts/ThemeContext";

interface TypographySectionProps {
  fontFamily: string;
  onChange: (key: "fontFamily", value: string) => void;
}

export default function TypographySection({
  fontFamily,
  onChange,
}: Readonly<TypographySectionProps>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {t("admin.branding.section_typography")}
      </h3>

      <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--border)]">
        <Select
          label={t("admin.branding.font_family")}
          value={fontFamily}
          onChange={(e) => onChange("fontFamily", e.target.value)}
          helperText={t("admin.branding.font_family_hint")}
        >
          {AVAILABLE_FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.name}
            </option>
          ))}
        </Select>

        {/* Font Preview */}
        <div className="mt-4 p-4 rounded-[var(--radius)] border border-[var(--border)]">
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
function FontPreview({ fontFamily }: Readonly<{ fontFamily: string }>) {
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
      link.remove();
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
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--foreground)]">
        <span className="font-light">Light</span>
        <span className="font-normal">Regular</span>
        <span className="font-medium">Medium</span>
        <span className="font-semibold">Semibold</span>
        <span className="font-bold">Bold</span>
      </div>
    </div>
  );
}
