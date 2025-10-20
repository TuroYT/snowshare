"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";

type User = {
  id: string;
  name?: string;
  email: string;
  createdAt: string;
};

type ProfileInfoProps = {
  user: User;
  onUpdate: (data: User) => void;
};

export default function ProfileInfo({ user, onUpdate }: ProfileInfoProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword && newPassword !== confirmPassword) {
      setError(t("profile.error_passwords_mismatch"));
      return;
    }

    if (newPassword && !currentPassword) {
      setError(t("profile.error_current_password_required"));
      return;
    }

    setSaving(true);

    try {
      const updateData: {
        name?: string;
        email?: string;
        currentPassword?: string;
        newPassword?: string;
      } = { name, email };

      if (newPassword) {
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      }

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(t("profile.success_update"));
        onUpdate(data.user);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(data.error || t("profile.error_update"));
      }
    } catch {
      setError(t("profile.error_update"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modern-card p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-700/50 flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">{t("profile.info_title")}</h2>
          <p className="text-sm text-gray-400">{t("profile.info_subtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t("profile.label_name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="modern-input w-full"
              placeholder={t("profile.placeholder_name")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t("profile.label_email")} <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="modern-input w-full"
              required
            />
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6">
          <h3 className="text-lg font-medium text-gray-200 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {t("profile.change_password")}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t("profile.label_current_password")}</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="modern-input w-full"
                placeholder={t("profile.placeholder_password")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t("profile.label_new_password")}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="modern-input w-full"
                placeholder={t("profile.placeholder_password")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t("profile.label_confirm_password")}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="modern-input w-full"
                placeholder={t("profile.placeholder_password")}
              />
            </div>
          </div>
        </div>

        {message && (
          <div className="modern-alert modern-alert-success">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm">{message}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="modern-alert modern-alert-error">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <button type="submit" disabled={saving} className="modern-button modern-button-primary w-full">
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {t("profile.saving")}
            </>
          ) : (
            t("profile.save_changes")
          )}
        </button>
      </form>
    </div>
  );
}
