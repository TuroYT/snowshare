"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/Toast";
import WarningModal from "@/components/admin/WarningModal";

interface CustomLink {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export default function CustomLinksSection() {
  const { t } = useTranslation();
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [formData, setFormData] = useState({ name: "", url: "" });
  const [errors, setErrors] = useState({ name: "", url: "" });
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);

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
      console.error("Failed to add custom link:", err);
    }
  };

  const handleDeleteLink = async (id: string) => {
    try {
      const response = await fetch(`/api/custom-links/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete link");

      setCustomLinks(customLinks.filter((link) => link.id !== id));
      toast.success(t("admin.save_success"));
    } catch (err) {
      toast.error(t("admin.links.error_delete"));
      console.error("Failed to delete custom link:", err);
    } finally {
      setLinkToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <WarningModal
        open={linkToDelete !== null}
        title={t("admin.links.title_list")}
        message={t("admin.links.confirm_delete")}
        onConfirm={() => linkToDelete && handleDeleteLink(linkToDelete)}
        onCancel={() => setLinkToDelete(null)}
      />

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
                  onClick={() => setLinkToDelete(link.id)}
                  className="ml-3 px-2 py-1 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                  title={t("admin.links.button_delete")}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
}
