"use client";

import { themePresets } from "@/lib/theme-presets";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useTranslation } from "react-i18next";
import type { PresetColors } from "@/lib/theme-presets";

interface ThemePresetSelectorProps {
  onSelectPreset: (colors: PresetColors) => void;
}

export function ThemePresetSelector({ onSelectPreset }: Readonly<ThemePresetSelectorProps>) {
  const { isDark } = useColorScheme();
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-muted)]">
        {t("admin.theme.presets_label", "Presets")}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {themePresets.map((preset) => {
          const colors = isDark ? preset.dark : preset.light;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(colors)}
              className="group min-w-0 p-3 rounded-[var(--radius)] border border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors duration-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              title={preset.description}
            >
              <div className="flex gap-1 mb-2">
                <span
                  className="w-5 h-5 rounded-full border border-[var(--border)]"
                  style={{ backgroundColor: colors.primaryColor }}
                  aria-hidden="true"
                />
                <span
                  className="w-5 h-5 rounded-full border border-[var(--border)]"
                  style={{ backgroundColor: colors.secondaryColor }}
                  aria-hidden="true"
                />
              </div>
              <p className="text-xs font-medium text-[var(--foreground)] truncate">{preset.name}</p>
              <p className="text-xs text-[var(--foreground-muted)] truncate mt-0.5">
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
