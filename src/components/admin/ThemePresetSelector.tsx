"use client";

import { themePresets } from "@/lib/theme-presets";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useTranslation } from "react-i18next";
import type { PresetColors } from "@/lib/theme-presets";

interface ThemePresetSelectorProps {
  onSelectPreset: (colors: PresetColors) => void;
}

export function ThemePresetSelector({ onSelectPreset }: ThemePresetSelectorProps) {
  const { isDark } = useColorScheme();
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">
        {t("admin.theme.presets_label", "Presets")}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {themePresets.map((preset) => {
          const colors = isDark ? preset.dark : preset.light;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(colors)}
              className="group p-3 rounded-[var(--radius-lg)] border border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors text-left"
              title={preset.description}
            >
              <div className="flex gap-1 mb-2">
                <span
                  className="w-5 h-5 rounded-full border border-black/10"
                  style={{ backgroundColor: colors.primaryColor }}
                />
                <span
                  className="w-5 h-5 rounded-full border border-black/10"
                  style={{ backgroundColor: colors.secondaryColor }}
                />
              </div>
              <p className="text-xs font-medium text-[var(--foreground)] truncate">{preset.name}</p>
              <p className="text-xs text-[var(--foreground-subtle)] truncate mt-0.5">
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[var(--foreground-muted)]">
        {t(
          "admin.theme.preset_helper",
          "Click a preset to pre-fill the color fields. You can customize them afterward."
        )}
      </p>
    </div>
  );
}
