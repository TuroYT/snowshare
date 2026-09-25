"use client";

import { useTranslation } from "react-i18next";

interface IdentitySectionProps {
  appName: string;
  appDescription: string;
  onChange: (key: "appName" | "appDescription", value: string) => void;
}

export default function IdentitySection({
  appName,
  appDescription,
  onChange,
}: IdentitySectionProps) {
  const { t } = useTranslation();

  return (
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
            value={appName}
            onChange={(e) => onChange("appName", e.target.value)}
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
            value={appDescription}
            onChange={(e) => onChange("appDescription", e.target.value)}
            className="w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            rows={2}
            placeholder="Share your files, pastes and URLs securely"
          />
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {t("admin.branding.app_description_hint")}
          </p>
        </div>
      </div>
    </div>
  );
}
