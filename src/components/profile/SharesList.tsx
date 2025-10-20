"use client";

import React from "react";
import ShareItem from "./ShareItem";
import { useTranslation } from "react-i18next";

type Share = {
  id: string;
  type: "FILE" | "PASTE" | "URL";
  slug: string;
  filePath?: string;
  paste?: string;
  pastelanguage?: string;
  urlOriginal?: string;
  password?: string;
  createdAt: string;
  expiresAt?: string;
};

type SharesListProps = {
  shares: Share[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<Share>) => void;
};

export default function SharesList({ shares, onDelete, onUpdate }: SharesListProps) {
  const { t } = useTranslation();
  
  if (shares.length === 0) {
    return (
      <div className="modern-card p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-gray-700/20 to-gray-800/20 border border-gray-700/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-1">{t("profile.no_shares")}</h3>
            <p className="text-sm text-gray-400">{t("profile.no_shares_desc")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-200">
          {t("profile.shares_count", { count: shares.length })}
        </h3>
      </div>
      {shares.map((share) => (
        <ShareItem key={share.id} share={share} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
