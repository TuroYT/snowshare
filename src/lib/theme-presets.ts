export interface PresetColors {
  primaryColor: string;
  primaryHover: string;
  primaryDark: string;
  secondaryColor: string;
  secondaryHover: string;
  secondaryDark: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  textMuted: string;
  borderColor: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  light: PresetColors;
  dark: PresetColors;
  /** Backward-compat: used when preset was applied as flat colors (legacy installs) */
  colors: PresetColors;
}

const SOBER_LIGHT: PresetColors = {
  primaryColor: "#3b82f6",
  primaryHover: "#2563eb",
  primaryDark: "#1e40af",
  secondaryColor: "#64748b",
  secondaryHover: "#475569",
  secondaryDark: "#334155",
  backgroundColor: "#fafaf9",
  surfaceColor: "#ffffff",
  textColor: "#1c1917",
  textMuted: "#78716c",
  borderColor: "#e7e5e4",
};
const SOBER_DARK: PresetColors = {
  primaryColor: "#3b82f6",
  primaryHover: "#2563eb",
  primaryDark: "#1e40af",
  secondaryColor: "#64748b",
  secondaryHover: "#475569",
  secondaryDark: "#334155",
  backgroundColor: "#0c0a09",
  surfaceColor: "#1c1917",
  textColor: "#f5f5f4",
  textMuted: "#a8a29e",
  borderColor: "#292524",
};

const GLACIER_LIGHT: PresetColors = {
  primaryColor: "#0ea5e9",
  primaryHover: "#0284c7",
  primaryDark: "#0369a1",
  secondaryColor: "#38bdf8",
  secondaryHover: "#0ea5e9",
  secondaryDark: "#0284c7",
  backgroundColor: "#f0f9ff",
  surfaceColor: "#ffffff",
  textColor: "#0c1a29",
  textMuted: "#475569",
  borderColor: "#e0f2fe",
};
const GLACIER_DARK: PresetColors = {
  primaryColor: "#38bdf8",
  primaryHover: "#0ea5e9",
  primaryDark: "#0284c7",
  secondaryColor: "#7dd3fc",
  secondaryHover: "#38bdf8",
  secondaryDark: "#0ea5e9",
  backgroundColor: "#0c1222",
  surfaceColor: "#0f1f35",
  textColor: "#f0f9ff",
  textMuted: "#bae6fd",
  borderColor: "#1e3a5f",
};

const INK_DARK: PresetColors = {
  primaryColor: "#f5f5f4",
  primaryHover: "#e7e5e4",
  primaryDark: "#d6d3d1",
  secondaryColor: "#78716c",
  secondaryHover: "#57534e",
  secondaryDark: "#44403c",
  backgroundColor: "#0c0a09",
  surfaceColor: "#1c1917",
  textColor: "#fafaf9",
  textMuted: "#a8a29e",
  borderColor: "#292524",
};
const INK_LIGHT: PresetColors = {
  primaryColor: "#1c1917",
  primaryHover: "#292524",
  primaryDark: "#44403c",
  secondaryColor: "#78716c",
  secondaryHover: "#57534e",
  secondaryDark: "#44403c",
  backgroundColor: "#fafaf9",
  surfaceColor: "#ffffff",
  textColor: "#1c1917",
  textMuted: "#78716c",
  borderColor: "#e7e5e4",
};

const LEGACY_DARK: PresetColors = {
  primaryColor: "#3B82F6",
  primaryHover: "#2563EB",
  primaryDark: "#1E40AF",
  secondaryColor: "#8B5CF6",
  secondaryHover: "#7C3AED",
  secondaryDark: "#6D28D9",
  backgroundColor: "#111827",
  surfaceColor: "#1F2937",
  textColor: "#F9FAFB",
  textMuted: "#D1D5DB",
  borderColor: "#374151",
};

export const themePresets: ThemePreset[] = [
  {
    id: "sober",
    name: "Sobre",
    description: "Minimal chaud, sobre et intemporel",
    light: SOBER_LIGHT,
    dark: SOBER_DARK,
    colors: SOBER_DARK,
  },
  {
    id: "glacier",
    name: "Glacier",
    description: "Bleus froids, blancs purs",
    light: GLACIER_LIGHT,
    dark: GLACIER_DARK,
    colors: GLACIER_DARK,
  },
  {
    id: "ink",
    name: "Encre",
    description: "Monochrome contrasté",
    light: INK_LIGHT,
    dark: INK_DARK,
    colors: INK_DARK,
  },
  {
    id: "legacy",
    name: "Legacy",
    description: "Bleu & violet — thème d'origine",
    light: LEGACY_DARK,
    dark: LEGACY_DARK,
    colors: LEGACY_DARK,
  },
  {
    id: "emerald",
    name: "Emerald Forest",
    description: "Fresh green",
    light: {
      primaryColor: "#10B981",
      primaryHover: "#059669",
      primaryDark: "#047857",
      secondaryColor: "#14B8A6",
      secondaryHover: "#0D9488",
      secondaryDark: "#0F766E",
      backgroundColor: "#f0fdf4",
      surfaceColor: "#ffffff",
      textColor: "#14532d",
      textMuted: "#4b7c5d",
      borderColor: "#d1fae5",
    },
    dark: {
      primaryColor: "#10B981",
      primaryHover: "#059669",
      primaryDark: "#047857",
      secondaryColor: "#14B8A6",
      secondaryHover: "#0D9488",
      secondaryDark: "#0F766E",
      backgroundColor: "#0F172A",
      surfaceColor: "#1E293B",
      textColor: "#F1F5F9",
      textMuted: "#CBD5E1",
      borderColor: "#334155",
    },
    colors: {
      primaryColor: "#10B981",
      primaryHover: "#059669",
      primaryDark: "#047857",
      secondaryColor: "#14B8A6",
      secondaryHover: "#0D9488",
      secondaryDark: "#0F766E",
      backgroundColor: "#0F172A",
      surfaceColor: "#1E293B",
      textColor: "#F1F5F9",
      textMuted: "#CBD5E1",
      borderColor: "#334155",
    },
  },
  {
    id: "sunset",
    name: "Sunset Glow",
    description: "Warm orange and pink",
    light: {
      primaryColor: "#F59E0B",
      primaryHover: "#D97706",
      primaryDark: "#B45309",
      secondaryColor: "#EC4899",
      secondaryHover: "#DB2777",
      secondaryDark: "#BE185D",
      backgroundColor: "#fffbf0",
      surfaceColor: "#ffffff",
      textColor: "#1c1917",
      textMuted: "#78716c",
      borderColor: "#e7e5e4",
    },
    dark: {
      primaryColor: "#F59E0B",
      primaryHover: "#D97706",
      primaryDark: "#B45309",
      secondaryColor: "#EC4899",
      secondaryHover: "#DB2777",
      secondaryDark: "#BE185D",
      backgroundColor: "#18181B",
      surfaceColor: "#27272A",
      textColor: "#FAFAFA",
      textMuted: "#D4D4D8",
      borderColor: "#3F3F46",
    },
    colors: {
      primaryColor: "#F59E0B",
      primaryHover: "#D97706",
      primaryDark: "#B45309",
      secondaryColor: "#EC4899",
      secondaryHover: "#DB2777",
      secondaryDark: "#BE185D",
      backgroundColor: "#18181B",
      surfaceColor: "#27272A",
      textColor: "#FAFAFA",
      textMuted: "#D4D4D8",
      borderColor: "#3F3F46",
    },
  },
  {
    id: "ocean",
    name: "Ocean Deep",
    description: "Cool blue",
    light: GLACIER_LIGHT,
    dark: {
      primaryColor: "#0EA5E9",
      primaryHover: "#0284C7",
      primaryDark: "#0369A1",
      secondaryColor: "#06B6D4",
      secondaryHover: "#0891B2",
      secondaryDark: "#0E7490",
      backgroundColor: "#0C1222",
      surfaceColor: "#1E293B",
      textColor: "#F0F9FF",
      textMuted: "#BAE6FD",
      borderColor: "#334155",
    },
    colors: {
      primaryColor: "#0EA5E9",
      primaryHover: "#0284C7",
      primaryDark: "#0369A1",
      secondaryColor: "#06B6D4",
      secondaryHover: "#0891B2",
      secondaryDark: "#0E7490",
      backgroundColor: "#0C1222",
      surfaceColor: "#1E293B",
      textColor: "#F0F9FF",
      textMuted: "#BAE6FD",
      borderColor: "#334155",
    },
  },
  {
    id: "ruby",
    name: "Ruby Red",
    description: "Bold red",
    light: {
      primaryColor: "#EF4444",
      primaryHover: "#DC2626",
      primaryDark: "#B91C1C",
      secondaryColor: "#F97316",
      secondaryHover: "#EA580C",
      secondaryDark: "#C2410C",
      backgroundColor: "#fff5f5",
      surfaceColor: "#ffffff",
      textColor: "#1c1917",
      textMuted: "#78716c",
      borderColor: "#fecaca",
    },
    dark: {
      primaryColor: "#EF4444",
      primaryHover: "#DC2626",
      primaryDark: "#B91C1C",
      secondaryColor: "#F97316",
      secondaryHover: "#EA580C",
      secondaryDark: "#C2410C",
      backgroundColor: "#1C1917",
      surfaceColor: "#292524",
      textColor: "#FEF2F2",
      textMuted: "#FECACA",
      borderColor: "#44403C",
    },
    colors: {
      primaryColor: "#EF4444",
      primaryHover: "#DC2626",
      primaryDark: "#B91C1C",
      secondaryColor: "#F97316",
      secondaryHover: "#EA580C",
      secondaryDark: "#C2410C",
      backgroundColor: "#1C1917",
      surfaceColor: "#292524",
      textColor: "#FEF2F2",
      textMuted: "#FECACA",
      borderColor: "#44403C",
    },
  },
  {
    id: "midnight",
    name: "Midnight Purple",
    description: "Deep purple",
    light: {
      primaryColor: "#A855F7",
      primaryHover: "#9333EA",
      primaryDark: "#7E22CE",
      secondaryColor: "#D946EF",
      secondaryHover: "#C026D3",
      secondaryDark: "#A21CAF",
      backgroundColor: "#fdf4ff",
      surfaceColor: "#ffffff",
      textColor: "#1c1917",
      textMuted: "#78716c",
      borderColor: "#f3e8ff",
    },
    dark: {
      primaryColor: "#A855F7",
      primaryHover: "#9333EA",
      primaryDark: "#7E22CE",
      secondaryColor: "#D946EF",
      secondaryHover: "#C026D3",
      secondaryDark: "#A21CAF",
      backgroundColor: "#0F0A1E",
      surfaceColor: "#1E1433",
      textColor: "#FAF5FF",
      textMuted: "#E9D5FF",
      borderColor: "#2E1F47",
    },
    colors: {
      primaryColor: "#A855F7",
      primaryHover: "#9333EA",
      primaryDark: "#7E22CE",
      secondaryColor: "#D946EF",
      secondaryHover: "#C026D3",
      secondaryDark: "#A21CAF",
      backgroundColor: "#0F0A1E",
      surfaceColor: "#1E1433",
      textColor: "#FAF5FF",
      textMuted: "#E9D5FF",
      borderColor: "#2E1F47",
    },
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Classic black and white",
    light: INK_LIGHT,
    dark: INK_DARK,
    colors: INK_DARK,
  },
];

export function getPresetById(id: string): ThemePreset | undefined {
  return themePresets.find((p) => p.id === id);
}
export function getPresetNames(): string[] {
  return themePresets.map((p) => p.name);
}
