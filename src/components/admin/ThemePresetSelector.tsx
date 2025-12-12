"use client"

import { themePresets } from "@/lib/theme-presets"

interface ThemePresetSelectorProps {
  onSelectPreset: (colors: Record<string, string>) => void
}

export function ThemePresetSelector({ onSelectPreset }: ThemePresetSelectorProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--foreground)]">Quick Presets</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {themePresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelectPreset(preset.colors)}
            className="group relative p-4 rounded-lg border border-[var(--border)] hover:border-[var(--border-hover)] transition-all overflow-hidden"
            title={preset.description}
          >
            {/* Color preview */}
            <div className="flex gap-1 mb-2">
              <div
                className="h-6 w-6 rounded-full border border-white/20"
                style={{ backgroundColor: preset.colors.primaryColor }}
              />
              <div
                className="h-6 w-6 rounded-full border border-white/20"
                style={{ backgroundColor: preset.colors.secondaryColor }}
              />
            </div>
            
            {/* Preset name */}
            <p className="text-xs font-medium text-[var(--foreground)] truncate">
              {preset.name}
            </p>
            
            {/* Hover effect */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
              style={{
                background: `linear-gradient(135deg, ${preset.colors.primaryColor} 0%, ${preset.colors.secondaryColor} 100%)`,
              }}
            />
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--foreground-muted)]">
        Click a preset to apply it instantly. You can customize colors after applying.
      </p>
    </div>
  )
}
