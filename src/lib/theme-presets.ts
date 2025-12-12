export interface ThemePreset {
  id: string
  name: string
  description: string
  colors: {
    primaryColor: string
    primaryHover: string
    primaryDark: string
    secondaryColor: string
    secondaryHover: string
    secondaryDark: string
    backgroundColor: string
    surfaceColor: string
    textColor: string
    textMuted: string
    borderColor: string
  }
}

export const themePresets: ThemePreset[] = [
  {
    id: "default",
    name: "Default (Blue & Purple)",
    description: "The default SnowShare theme",
    colors: {
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
    },
  },
  {
    id: "emerald",
    name: "Emerald Forest",
    description: "Fresh green theme inspired by nature",
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
    description: "Warm orange and pink theme",
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
    description: "Cool blue theme inspired by the sea",
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
    description: "Bold red theme with high energy",
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
    description: "Deep purple theme for a mysterious vibe",
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
    description: "Classic black and white theme",
    colors: {
      primaryColor: "#FFFFFF",
      primaryHover: "#F5F5F5",
      primaryDark: "#E5E5E5",
      secondaryColor: "#A3A3A3",
      secondaryHover: "#8C8C8C",
      secondaryDark: "#737373",
      backgroundColor: "#000000",
      surfaceColor: "#171717",
      textColor: "#FFFFFF",
      textMuted: "#A3A3A3",
      borderColor: "#262626",
    },
  },
]

export function getPresetById(id: string): ThemePreset | undefined {
  return themePresets.find((preset) => preset.id === id)
}

export function getPresetNames(): string[] {
  return themePresets.map((preset) => preset.name)
}
