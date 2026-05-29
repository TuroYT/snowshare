"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/Toast";
import WaveSkeleton from "@/components/ui/WaveSkeleton";
import SkeletonTransition from "@/components/ui/SkeletonTransition";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import Image from "next/image";
import { ThemePresetSelector } from "./ThemePresetSelector";
import { AVAILABLE_FONTS } from "@/contexts/ThemeContext";

interface CustomLink {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

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
    appName: s.appName || "SnowShare",
    appDescription: s.appDescription || "Partagez vos fichiers, pastes et URLs en toute sécurité",
    logoUrl: s.logoUrl || null,
    faviconUrl: s.faviconUrl || null,
    primaryColor: s.primaryColor || "#3B82F6",
    primaryHover: s.primaryHover || "#2563EB",
    primaryDark: s.primaryDark || "#1E40AF",
    secondaryColor: s.secondaryColor || "#8B5CF6",
    secondaryHover: s.secondaryHover || "#7C3AED",
    secondaryDark: s.secondaryDark || "#6D28D9",
    backgroundColor: s.backgroundColor || "#111827",
    backgroundImageUrl: s.backgroundImageUrl || null,
    surfaceColor: s.surfaceColor || "#1F2937",
    textColor: s.textColor || "#F9FAFB",
    textMuted: s.textMuted || "#D1D5DB",
    borderColor: s.borderColor || "#374151",
    fontFamily: s.fontFamily || "Geist",
  };
}

export default function BrandingTab() {
  const { t } = useTranslation();
  const { updateTheme, refreshSettings } = useTheme();
  const [settings, setSettings] = useState<BrandingSettings>({
    appName: "SnowShare",
    appDescription: "Partagez vos fichiers, pastes et URLs en toute sécurité",
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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [formData, setFormData] = useState({ name: "", url: "" });
  const [errors, setErrors] = useState({ name: "", url: "" });

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
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const fetchLinks = useCallback(async () => {
    try {
      const response = await fetch("/api/custom-links");
      if (response.ok) {
        const data = await response.json();
        setCustomLinks(data.links || []);
      }
    } catch (err) {
      console.error("Failed to fetch custom links:", err);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const validateLinkForm = (): boolean => {
    const newErrors = { name: "", url: "" };

    if (!formData.name.trim()) {
      newErrors.name = t("admin.links.error_name_required");
    }

    if (!formData.url.trim()) {
      newErrors.url = t("admin.links.error_url_required");
    } else {
      try {
        new URL(formData.url.trim());
      } catch {
        newErrors.url = t("admin.links.error_url_invalid");
      }
    }

    setErrors(newErrors);
    return !newErrors.name && !newErrors.url;
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateLinkForm()) return;

    try {
      const response = await fetch("/api/custom-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          url: formData.url.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add link");
      }

      const data = await response.json();
      setCustomLinks([...customLinks, data.link]);
      setFormData({ name: "", url: "" });
      setErrors({ name: "", url: "" });
      toast.success(t("admin.save_success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.links.error_add"));
      console.error(err);
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm(t("admin.links.confirm_delete"))) return;

    try {
      const response = await fetch(`/api/custom-links/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete link");

      setCustomLinks(customLinks.filter((link) => link.id !== id));
      toast.success(t("admin.save_success"));
    } catch (err) {
      toast.error(t("admin.links.error_delete"));
      console.error(err);
    }
  };

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
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSettings({
      appName: "SnowShare",
      appDescription: "Partagez vos fichiers, pastes et URLs en toute sécurité",
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
    });
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
        {/* App Identity */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary-dark)]/50 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[var(--primary)]"
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
              {t("admin.branding.section_identity")}
            </h3>
          </div>

          <div className="space-y-4 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
            {/* App Name */}
            <div>
              <label className="text-sm text-[var(--foreground)] block mb-2">
                {t("admin.branding.app_name")}
              </label>
              <input
                type="text"
                value={settings.appName}
                onChange={(e) => handleChange("appName", e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="SnowShare"
              />
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {t("admin.branding.app_name_hint")}
              </p>
            </div>

            {/* App Description */}
            <div>
              <label className="text-sm text-[var(--foreground)] block mb-2">
                {t("admin.branding.app_description")}
              </label>
              <textarea
                value={settings.appDescription}
                onChange={(e) => handleChange("appDescription", e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                rows={2}
                placeholder="Partagez vos fichiers, pastes et URLs en toute sécurité"
              />
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {t("admin.branding.app_description_hint")}
              </p>
            </div>
          </div>
        </div>

        {/* Logo & Favicon */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-[var(--secondary)]/20 border border-[var(--secondary-dark)]/50 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[var(--secondary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {t("admin.branding.section_images")}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Logo URL */}
            <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
              <label className="text-sm text-[var(--foreground)] block mb-2">
                {t("admin.branding.logo_url")}
              </label>
              <input
                type="url"
                value={settings.logoUrl || ""}
                onChange={(e) => handleChange("logoUrl", e.target.value || null)}
                className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {t("admin.branding.logo_url_hint")}
              </p>
              {settings.logoUrl && (
                <div className="mt-3 p-2 bg-[var(--surface)]/50 rounded-lg">
                  <p className="text-xs text-[var(--foreground-muted)] mb-2">
                    {t("admin.branding.preview")}
                  </p>
                  <Image
                    src={settings.logoUrl}
                    alt="Logo preview"
                    width={120}
                    height={40}
                    className="h-10 w-auto object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Favicon URL */}
            <div className="p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
              <label className="text-sm text-[var(--foreground)] block mb-2">
                {t("admin.branding.favicon_url")}
              </label>
              <input
                type="url"
                value={settings.faviconUrl || ""}
                onChange={(e) => handleChange("faviconUrl", e.target.value || null)}
                className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="https://example.com/favicon.ico"
              />
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {t("admin.branding.favicon_url_hint")}
              </p>
              {settings.faviconUrl && (
                <div className="mt-3 p-2 bg-[var(--surface)]/50 rounded-lg">
                  <p className="text-xs text-[var(--foreground-muted)] mb-2">
                    {t("admin.branding.preview")}
                  </p>
                  <Image
                    src={settings.faviconUrl}
                    alt="Favicon preview"
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Typography */}
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
              value={settings.fontFamily}
              onChange={(e) => handleChange("fontFamily", e.target.value)}
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
              <FontPreview fontFamily={settings.fontFamily} />
            </div>
          </div>
        </div>

        {/* Colors */}
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
            <ThemePresetSelector
              onSelectPreset={(colors) => {
                setSettings({
                  ...settings,
                  ...colors,
                });
                // Apply preset immediately for live preview
                updateTheme(colors);
              }}
            />
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
                value={settings.primaryColor}
                onChange={(v) => handleChange("primaryColor", v)}
              />
              <ColorInput
                label={t("admin.branding.secondary_label", "Secondary")}
                value={settings.secondaryColor}
                onChange={(v) => handleChange("secondaryColor", v)}
              />
            </div>
          </div>

          {/* Background image (orthogonal to color system) */}
          <div className="p-4 bg-[var(--surface-hover)] rounded-[var(--radius-lg)] border border-[var(--border)]">
            <h4 className="text-sm font-semibold text-[var(--foreground)] mb-4">
              {t("admin.branding.background_image_url", "Background image")}
            </h4>
            <input
              type="url"
              value={settings.backgroundImageUrl || ""}
              onChange={(e) => handleChange("backgroundImageUrl", e.target.value || null)}
              className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--foreground)]"
              placeholder="https://example.com/background.jpg"
            />
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              {t("admin.branding.background_image_url_hint")}
            </p>
            {settings.backgroundImageUrl && (
              <div className="mt-3 p-2 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)]">
                <p className="text-xs text-[var(--foreground-muted)] mb-2">
                  {t("admin.branding.background_image_preview")}
                </p>
                <BackgroundImagePreview url={settings.backgroundImageUrl} />
              </div>
            )}
          </div>
        </div>

        {/* Custom Links Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            {t("admin.links.title_add")}
          </h3>

          <form
            onSubmit={handleAddLink}
            className="space-y-4 p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50"
          >
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                {t("admin.links.label_name")}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("admin.links.placeholder_name")}
                className={`w-full px-3 py-2 bg-[var(--surface)]/50 border rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 ${
                  errors.name
                    ? "border-red-500 focus:ring-red-500"
                    : "border-[var(--border)]/50 focus:ring-[var(--primary)]"
                }`}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                {t("admin.links.label_url")}
              </label>
              <input
                type="text"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder={t("admin.links.placeholder_url")}
                className={`w-full px-3 py-2 bg-[var(--surface)]/50 border rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 ${
                  errors.url
                    ? "border-red-500 focus:ring-red-500"
                    : "border-[var(--border)]/50 focus:ring-[var(--primary)]"
                }`}
              />
              {errors.url && <p className="text-red-500 text-sm mt-1">{errors.url}</p>}
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[var(--radius)] font-medium transition-colors"
            >
              {t("admin.links.button_add")}
            </button>
          </form>

          {/* Links List */}
          <div>
            <h4 className="text-base font-semibold text-[var(--foreground)] mb-3">
              {t("admin.links.title_list")}
            </h4>

            {customLinks.length === 0 ? (
              <div className="p-4 text-center bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
                <p className="text-[var(--foreground-muted)]">{t("admin.links.no_links")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-3 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50 flex items-center justify-between hover:border-[var(--border)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--foreground)] font-medium text-sm truncate">
                        {link.name}
                      </p>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] truncate block"
                      >
                        {link.url}
                      </a>
                    </div>
                    <button
                      onClick={() => handleDeleteLink(link.id)}
                      className="ml-3 px-2 py-1 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                      title={t("admin.links.button_delete")}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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

function BackgroundImagePreview({ url }: { url: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
    const img = new window.Image();
    img.onload = () => setStatus("ok");
    img.onerror = () => setStatus("error");
    img.src = url;
  }, [url]);

  if (status === "loading") {
    return (
      <div className="w-full h-32 rounded-lg flex items-center justify-center bg-[var(--surface)]/30">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full h-32 rounded-lg flex flex-col items-center justify-center bg-red-900/20 border border-red-800/50 text-red-400 text-sm gap-2">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        {t(
          "admin.branding.background_image_error",
          "Unable to load image. Check that the URL points to a valid image."
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-32 rounded-lg overflow-hidden">
      <Image
        src={url}
        alt="Background preview"
        fill
        className="object-cover"
        onError={() => setStatus("error")}
      />
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
