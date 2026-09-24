"use client";

import { useTranslation } from "react-i18next";
import { ThemePresetSelector } from "@/components/admin/ThemePresetSelector";
import type { PresetColors } from "@/lib/theme-presets";

interface ColorsSectionProps {
  primaryColor: string;
  secondaryColor: string;
  onChange: (key: "primaryColor" | "secondaryColor", value: string) => void;
  onSelectPreset: (colors: PresetColors) => void;
}

export default function ColorsSection({
  primaryColor,
  secondaryColor,
  onChange,
  onSelectPreset,
}: ColorsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-green-600/20 border border-green-700/50 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          {t("admin.branding.section_colors")}
        </h3>
      </div>

      {/* Theme Presets */}
      <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
        <ThemePresetSelector onSelectPreset={onSelectPreset} />
      </div>

      {/* Accent colors — primary and secondary; chrome colors managed by the theme system */}
      <div className="p-4 bg-[var(--surface-hover)] rounded-[var(--radius-lg)] border border-[var(--border)]">
        <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">
          {t("admin.branding.accent_colors_label", "Accent colors")}
        </h4>
        <p className="text-xs text-[var(--foreground-muted)] mb-4">
          {t(
            "admin.branding.accent_colors_hint",
            "Used for buttons, links, and focus states. Selecting a preset above overrides these."
          )}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorInput
            label={t("admin.branding.primary_label", "Primary")}
            value={primaryColor}
            onChange={(v) => onChange("primaryColor", v)}
          />
          <ColorInput
            label={t("admin.branding.secondary_label", "Secondary")}
            value={secondaryColor}
            onChange={(v) => onChange("secondaryColor", v)}
          />
        </div>
      </div>
    </div>
  );
}

// Reusable component for color inputs
function ColorInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs text-[var(--foreground)] block mb-2">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-[var(--radius)] border border-[var(--border)] cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--foreground)] font-mono"
          placeholder="#000000"
        />
      </div>
      {hint && <p className="text-xs text-[var(--foreground-muted)] mt-1">{hint}</p>}
    </div>
  );
}
