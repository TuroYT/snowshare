"use client";

import React from "react";
import { useTranslation } from "react-i18next";

type Share = {
  id: string;
  type: "FILE" | "PASTE" | "URL";
  createdAt: string;
  expiresAt?: string;
};

type ProfileStatsProps = {
  shares: Share[];
};

export default function ProfileStats({ shares }: ProfileStatsProps) {
  const { t } = useTranslation();
  const totalShares = shares.length;
  const fileShares = shares.filter((s) => s.type === "FILE").length;
  const pasteShares = shares.filter((s) => s.type === "PASTE").length;
  const urlShares = shares.filter((s) => s.type === "URL").length;
  
  const activeShares = shares.filter((s) => !s.expiresAt || new Date(s.expiresAt) > new Date()).length;
  const expiredShares = totalShares - activeShares;

  const stats = [
    {
      label: t("profile.stats_total"),
      value: totalShares,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
      ),
      color: "from-blue-600/20 to-blue-800/20 border-[var(--primary-dark)]/50 text-[var(--primary)]",
    },
    {
      label: t("profile.stats_files"),
      value: fileShares,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      color: "from-purple-600/20 to-purple-800/20 border-[var(--secondary-dark)]/50 text-[var(--secondary)]",
    },
    {
      label: t("profile.stats_pastes"),
      value: pasteShares,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      ),
      color: "from-indigo-600/20 to-indigo-800/20 border-indigo-700/50 text-indigo-400",
    },
    {
      label: t("profile.stats_links"),
      value: urlShares,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      ),
      color: "from-green-600/20 to-green-800/20 border-green-700/50 text-green-400",
    },
    {
      label: t("profile.stats_active"),
      value: activeShares,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      color: "from-emerald-600/20 to-emerald-800/20 border-emerald-700/50 text-emerald-400",
    },
    {
      label: t("profile.stats_expired"),
      value: expiredShares,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: "from-orange-600/20 to-orange-800/20 border-orange-700/50 text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {stats.map((stat, index) => (
        <div key={index} className="modern-card p-4">
          <div className="flex flex-col items-center text-center gap-3">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br border flex items-center justify-center ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stat.value}</p>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
