"use client";

import { useId } from "react";
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
}: Readonly<ColorsSectionProps>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {t("admin.branding.section_colors")}
      </h3>

      {/* Theme Presets */}
      <ThemePresetSelector onSelectPreset={onSelectPreset} />

      {/* Accent colors — primary and secondary; chrome colors managed by the theme system */}
      <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--border)]">
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
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs text-[var(--foreground-muted)] block mb-1.5">
        {label}
      </label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 shrink-0 rounded-[var(--radius)] border border-[var(--border)] cursor-pointer bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 px-2 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--foreground)] font-mono transition-colors duration-100"
          placeholder="#000000"
        />
      </div>
      {hint && <p className="text-xs text-[var(--foreground-muted)] mt-1">{hint}</p>}
    </div>
  );
}
