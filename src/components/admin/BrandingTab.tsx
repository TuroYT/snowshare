"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/Toast";
import WaveSkeleton from "@/components/ui/WaveSkeleton";
import SkeletonTransition from "@/components/ui/SkeletonTransition";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import IdentitySection from "./branding/IdentitySection";
import LogoFaviconSection from "./branding/LogoFaviconSection";
import TypographySection from "./branding/TypographySection";
import ColorsSection from "./branding/ColorsSection";
import BackgroundImageSection from "./branding/BackgroundImageSection";
import CustomLinksSection from "./branding/CustomLinksSection";
import type { PresetColors } from "@/lib/theme-presets";

interface BrandingSettings {
  appName: string;
  appDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  primaryHover: string;
  primaryDark: string;
  secondaryColor: string;
  secondaryHover: string;
  secondaryDark: string;
  backgroundColor: string;
  backgroundImageUrl: string | null;
  surfaceColor: string;
  textColor: string;
  textMuted: string;
  borderColor: string;
  fontFamily: string;
}

const DEFAULT_SETTINGS: BrandingSettings = {
  appName: "SnowShare",
  appDescription: "Share your files, pastes and URLs securely",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#3B82F6",
  primaryHover: "#2563EB",
  primaryDark: "#1E40AF",
  secondaryColor: "#8B5CF6",
  secondaryHover: "#7C3AED",
  secondaryDark: "#6D28D9",
  backgroundColor: "#111827",
  backgroundImageUrl: null,
  surfaceColor: "#1F2937",
  textColor: "#F9FAFB",
  textMuted: "#D1D5DB",
  borderColor: "#374151",
  fontFamily: "Geist",
};

function darkenHex(hex: string, factor: number): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return hex;
  const r = Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * (1 - factor)));
  const g = Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * (1 - factor)));
  const b = Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * (1 - factor)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function mapBrandingFromApi(s: Record<string, string | null>): BrandingSettings {
  return {
    appName: s.appName || DEFAULT_SETTINGS.appName,
    appDescription: s.appDescription || DEFAULT_SETTINGS.appDescription,
    logoUrl: s.logoUrl || null,
    faviconUrl: s.faviconUrl || null,
    primaryColor: s.primaryColor || DEFAULT_SETTINGS.primaryColor,
    primaryHover: s.primaryHover || DEFAULT_SETTINGS.primaryHover,
    primaryDark: s.primaryDark || DEFAULT_SETTINGS.primaryDark,
    secondaryColor: s.secondaryColor || DEFAULT_SETTINGS.secondaryColor,
    secondaryHover: s.secondaryHover || DEFAULT_SETTINGS.secondaryHover,
    secondaryDark: s.secondaryDark || DEFAULT_SETTINGS.secondaryDark,
    backgroundColor: s.backgroundColor || DEFAULT_SETTINGS.backgroundColor,
    backgroundImageUrl: s.backgroundImageUrl || null,
    surfaceColor: s.surfaceColor || DEFAULT_SETTINGS.surfaceColor,
    textColor: s.textColor || DEFAULT_SETTINGS.textColor,
    textMuted: s.textMuted || DEFAULT_SETTINGS.textMuted,
    borderColor: s.borderColor || DEFAULT_SETTINGS.borderColor,
    fontFamily: s.fontFamily || DEFAULT_SETTINGS.fontFamily,
  };
}

export default function BrandingTab() {
  const { t } = useTranslation();
  const { updateTheme, refreshSettings } = useTheme();
  const [settings, setSettings] = useState<BrandingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isHexColor = (v: string) => /^#([0-9A-Fa-f]{6})$/.test(v?.trim?.() || "");
  const isValidUrl = (v: string) => {
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  };

  const validateSettingsBeforeSave = (): boolean => {
    // Required text fields
    if (!settings.appName?.trim() || !settings.appDescription?.trim()) {
      toast.error(t("admin.validation_required"));
      return false;
    }

    // Validate colors
    const colorKeys: (keyof BrandingSettings)[] = [
      "primaryColor",
      "primaryHover",
      "primaryDark",
      "secondaryColor",
      "secondaryHover",
      "secondaryDark",
      "backgroundColor",
      "surfaceColor",
      "textColor",
      "textMuted",
      "borderColor",
    ];

    for (const key of colorKeys) {
      const val = settings[key] as string;
      if (!val || !isHexColor(val)) {
        toast.error(t("admin.validation_invalid_color"));
        return false;
      }
    }

    // Optional URLs when provided
    if (settings.logoUrl && !isValidUrl(settings.logoUrl)) {
      toast.error(t("admin.validation_invalid_url"));
      return false;
    }
    if (settings.faviconUrl && !isValidUrl(settings.faviconUrl)) {
      toast.error(t("admin.validation_invalid_url"));
      return false;
    }

    return true;
  };

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data = await response.json();
      setSettings(mapBrandingFromApi(data.settings));
    } catch (err) {
      toast.error(t("admin.error_load_data"));
      console.error("Failed to fetch branding settings:", err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (key: keyof BrandingSettings, value: string | null) => {
    const updates: Partial<BrandingSettings> = { [key]: value };

    if (key === "primaryColor" && value && /^#[0-9A-Fa-f]{6}$/.test(value)) {
      updates.primaryHover = darkenHex(value, 0.1);
      updates.primaryDark = darkenHex(value, 0.25);
    } else if (key === "secondaryColor" && value && /^#[0-9A-Fa-f]{6}$/.test(value)) {
      updates.secondaryHover = darkenHex(value, 0.1);
      updates.secondaryDark = darkenHex(value, 0.25);
    }

    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    // Live preview: update theme immediately for color changes
    if (key.includes("Color")) {
      updateTheme(updates as Partial<Parameters<typeof updateTheme>[0]>);
    }
  };

  const handleSelectPreset = (colors: PresetColors) => {
    setSettings((prev) => ({ ...prev, ...colors }));
    // Apply preset immediately for live preview
    updateTheme(colors);
  };

  const handleSave = async () => {
    try {
      if (!validateSettingsBeforeSave()) return;
      setSaving(true);
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      // Update theme with new colors (live preview)
      updateTheme({
        primaryColor: settings.primaryColor,
        primaryHover: settings.primaryHover,
        primaryDark: settings.primaryDark,
        secondaryColor: settings.secondaryColor,
        secondaryHover: settings.secondaryHover,
        secondaryDark: settings.secondaryDark,
        backgroundColor: settings.backgroundColor,
        surfaceColor: settings.surfaceColor,
        textColor: settings.textColor,
        textMuted: settings.textMuted,
        borderColor: settings.borderColor,
      });

      // Show toast and refresh theme (metadata + favicon) without full reload
      toast.success(t("admin.save_success"));
      await refreshSettings({ force: true });
    } catch (err) {
      toast.error(t("admin.save_error"));
      console.error("Failed to save branding settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const SkeletonSection = ({ fields }: { fields: number }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <WaveSkeleton variant="rounded" width={32} height={32} />
        <WaveSkeleton variant="text" width={160} height={26} />
      </div>
      <div className="space-y-4 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i}>
            <WaveSkeleton variant="text" width={120} height={18} sx={{ mb: 1 }} />
            <WaveSkeleton variant="rounded" height={40} />
          </div>
        ))}
      </div>
    </div>
  );

  const skeleton = (
    <div className="space-y-6 w-full">
      <SkeletonSection fields={2} />
      <SkeletonSection fields={2} />
      <SkeletonSection fields={1} />
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <WaveSkeleton variant="rounded" width={32} height={32} />
          <WaveSkeleton variant="text" width={160} height={26} />
        </div>
        <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[0, 1, 2, 3].map((i) => (
              <WaveSkeleton key={i} variant="rounded" width={80} height={32} />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <WaveSkeleton variant="text" width={80} height={16} sx={{ mb: 0.5 }} />
                <WaveSkeleton variant="rounded" height={40} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <SkeletonSection fields={2} />
      <div className="flex gap-3 justify-end">
        <WaveSkeleton variant="rounded" width={120} height={42} />
        <WaveSkeleton variant="rounded" width={120} height={42} />
      </div>
    </div>
  );

  return (
    <SkeletonTransition loading={loading} skeleton={skeleton} className="w-full">
      <div className="space-y-6 w-full">
        <IdentitySection
          appName={settings.appName}
          appDescription={settings.appDescription}
          onChange={handleChange}
        />

        <LogoFaviconSection
          logoUrl={settings.logoUrl}
          faviconUrl={settings.faviconUrl}
          onChange={handleChange}
        />

        <TypographySection fontFamily={settings.fontFamily} onChange={handleChange} />

        <div className="space-y-4">
          <ColorsSection
            primaryColor={settings.primaryColor}
            secondaryColor={settings.secondaryColor}
            onChange={handleChange}
            onSelectPreset={handleSelectPreset}
          />

          {/* Background image (orthogonal to color system) */}
          <BackgroundImageSection
            backgroundImageUrl={settings.backgroundImageUrl}
            onChange={handleChange}
          />
        </div>

        <CustomLinksSection />

        {/* Info Box */}
        <div className="p-4 bg-[var(--primary)]/10 border border-[var(--primary-dark)]/30 rounded-lg text-[var(--primary-hover)] text-sm">
          <p className="font-medium mb-2">💡 {t("admin.branding.info_title")}</p>
          <ul className="space-y-1 text-xs">
            <li>• {t("admin.branding.info_1")}</li>
            <li>• {t("admin.branding.info_2")}</li>
            <li>• {t("admin.branding.info_3")}</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2 bg-[var(--surface)]/50 hover:bg-[var(--surface)] text-[var(--foreground)] rounded-lg font-medium transition-all"
          >
            {t("admin.branding.reset_defaults")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[var(--radius)] font-medium transition-colors disabled:opacity-50"
          >
            {saving ? t("admin.settings.saving") : t("admin.settings.save")}
          </button>
        </div>
      </div>
    </SkeletonTransition>
  );
}
