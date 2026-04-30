"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Snackbar, Alert as MuiAlert, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";

type EmailType = "share" | "verify";

interface EmailTemplates {
  emailDefaultLocale: string;
  shareEmailSubject: string | null;
  shareEmailHtml: string | null;
  shareEmailText: string | null;
  verifyEmailSubject: string | null;
  verifyEmailHtml: string | null;
  verifyEmailText: string | null;
}

interface DefaultTemplates {
  shareEmailSubject: string;
  shareEmailHtml: string;
  shareEmailText: string;
  verifyEmailSubject: string;
  verifyEmailHtml: string;
  verifyEmailText: string;
}

interface PreviewResult {
  subject: string;
  html: string;
  text: string;
}

const LOCALES = ["en", "fr", "es", "de", "nl", "pl"] as const;

export default function EmailTemplatesTab() {
  const { t } = useTranslation();
  const [activeType, setActiveType] = useState<EmailType>("share");
  const [templates, setTemplates] = useState<EmailTemplates>({
    emailDefaultLocale: "en",
    shareEmailSubject: null,
    shareEmailHtml: null,
    shareEmailText: null,
    verifyEmailSubject: null,
    verifyEmailHtml: null,
    verifyEmailText: null,
  });
  const [defaults, setDefaults] = useState<DefaultTemplates | null>(null);

  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastErrorOpen, setToastErrorOpen] = useState(false);
  const [toastTestOpen, setToastTestOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ─── Load templates ─────────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/email-templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      setTemplates(data.templates);
      setDefaults(data.defaults);
    } catch (err) {
      console.error(err);
      setErrorMsg(t("admin.email_templates.error_load", "Failed to load email templates."));
      setToastErrorOpen(true);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ─── Sync form fields when type or templates change ─────────────────────────

  useEffect(() => {
    if (!defaults) return;
    if (activeType === "share") {
      setSubject(templates.shareEmailSubject ?? defaults.shareEmailSubject);
      setHtml(templates.shareEmailHtml ?? defaults.shareEmailHtml);
      setText(templates.shareEmailText ?? defaults.shareEmailText);
    } else {
      setSubject(templates.verifyEmailSubject ?? defaults.verifyEmailSubject);
      setHtml(templates.verifyEmailHtml ?? defaults.verifyEmailHtml);
      setText(templates.verifyEmailText ?? defaults.verifyEmailText);
    }
  }, [activeType, templates, defaults]);

  // ─── Live preview (debounced) ────────────────────────────────────────────────

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeType,
          subject: subject || null,
          html: html || null,
          text: text || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreview(data.preview);
      }
    } catch (err) {
      console.error("Preview error:", err);
    } finally {
      setPreviewLoading(false);
    }
  }, [activeType, subject, html, text]);

  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(refreshPreview, 600);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [refreshPreview]);

  // Write preview HTML into iframe
  useEffect(() => {
    if (iframeRef.current && preview?.html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(preview.html);
        doc.close();
      }
    }
  }, [preview?.html]);

  // ─── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const patchData: Partial<EmailTemplates> = {
        emailDefaultLocale: templates.emailDefaultLocale,
      };

      if (activeType === "share") {
        patchData.shareEmailSubject = subject || null;
        patchData.shareEmailHtml = html || null;
        patchData.shareEmailText = text || null;
      } else {
        patchData.verifyEmailSubject = subject || null;
        patchData.verifyEmailHtml = html || null;
        patchData.verifyEmailText = text || null;
      }

      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });

      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setTemplates((prev) => ({ ...prev, ...data.templates }));
      setToastOpen(true);
    } catch (err) {
      console.error(err);
      setErrorMsg(t("admin.save_error", "Error saving changes"));
      setToastErrorOpen(true);
    } finally {
      setSaving(false);
    }
  };

  // ─── Reset to defaults ───────────────────────────────────────────────────────

  const handleReset = async () => {
    if (!defaults) return;
    setSaving(true);
    try {
      const patchData: Partial<EmailTemplates> = {};
      if (activeType === "share") {
        patchData.shareEmailSubject = null;
        patchData.shareEmailHtml = null;
        patchData.shareEmailText = null;
      } else {
        patchData.verifyEmailSubject = null;
        patchData.verifyEmailHtml = null;
        patchData.verifyEmailText = null;
      }

      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });
      if (!res.ok) throw new Error("Reset failed");
      const data = await res.json();
      setTemplates((prev) => ({ ...prev, ...data.templates }));
      setToastOpen(true);
    } catch (err) {
      console.error(err);
      setErrorMsg(t("admin.save_error", "Error saving changes"));
      setToastErrorOpen(true);
    } finally {
      setSaving(false);
    }
  };

  // ─── Send test email ─────────────────────────────────────────────────────────

  const handleSendTest = async () => {
    setTestSending(true);
    try {
      const res = await fetch("/api/admin/email-templates/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeType,
          subject: subject || null,
          html: html || null,
          text: text || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Send failed");
      }
      setToastTestOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || t("admin.email_templates.test_error", "Failed to send test email."));
      setToastErrorOpen(true);
    } finally {
      setTestSending(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <CircularProgress size={40} />
      </div>
    );
  }

  const emailTypes: EmailType[] = ["share", "verify"];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          {t("admin.email_templates.title", "Email Templates")}
        </h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          {t(
            "admin.email_templates.description",
            "Customize the HTML/text content and subject line of outgoing emails. Use {{appName}}, {{shareTitle}}, {{shareUrl}}, or {{verifyUrl}} as placeholders."
          )}
        </p>
      </div>

      {/* Default locale selector */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-medium text-[var(--foreground)]">
          {t("admin.email_templates.default_locale", "Default locale")}
        </label>
        <select
          value={templates.emailDefaultLocale}
          onChange={(e) =>
            setTemplates((prev) => ({ ...prev, emailDefaultLocale: e.target.value }))
          }
          className="bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {LOCALES.map((loc) => (
            <option key={loc} value={loc}>
              {loc.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Email type tabs */}
      <div className="flex gap-2 mb-6 border-b border-[var(--border)]/50">
        {emailTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              activeType === type
                ? "border-blue-500 text-[var(--primary)]"
                : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {type === "share"
              ? t("admin.email_templates.type_share", "Share Email")
              : t("admin.email_templates.type_verify", "Verification Email")}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Editor column */}
        <div className="space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              {t("admin.email_templates.subject", "Subject")}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("admin.email_templates.subject_placeholder", "Email subject…")}
            />
          </div>

          {/* HTML */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              {t("admin.email_templates.html_body", "HTML Body")}
            </label>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={14}
              spellCheck={false}
              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="<div>…</div>"
            />
          </div>

          {/* Plain text */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              {t("admin.email_templates.text_body", "Plain Text Body")}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              spellCheck={false}
              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder={t("admin.email_templates.text_placeholder", "Plain text fallback…")}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? t("admin.email_templates.saving", "Saving…") : t("common.save", "Save")}
            </button>
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 bg-[var(--surface)] hover:bg-[var(--border)] disabled:opacity-50 text-[var(--foreground)] text-sm font-medium rounded-lg border border-[var(--border)] transition-colors"
            >
              {t("admin.email_templates.reset_defaults", "Reset to defaults")}
            </button>
            <button
              onClick={handleSendTest}
              disabled={testSending}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {testSending
                ? t("admin.email_templates.sending_test", "Sending…")
                : t("admin.email_templates.send_test", "Send test email")}
            </button>
          </div>
        </div>

        {/* Preview column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              {t("admin.email_templates.preview_title", "Live Preview")}
            </h3>
            {previewLoading && <CircularProgress size={16} />}
          </div>

          {preview && (
            <>
              {/* Rendered subject */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
                <p className="text-xs text-[var(--foreground-muted)] mb-1 font-medium uppercase tracking-wide">
                  {t("admin.email_templates.preview_subject", "Subject")}
                </p>
                <p className="text-sm text-[var(--foreground)]">{preview.subject}</p>
              </div>

              {/* HTML preview in sandboxed iframe */}
              <div className="bg-white rounded-lg border border-[var(--border)] overflow-hidden">
                <p className="text-xs text-gray-500 px-3 py-1.5 border-b border-gray-200 font-medium uppercase tracking-wide">
                  {t("admin.email_templates.preview_html", "HTML")}
                </p>
                <iframe
                  ref={iframeRef}
                  title="email-preview"
                  sandbox="allow-same-origin"
                  className="w-full border-0"
                  style={{ height: "380px" }}
                />
              </div>

              {/* Plain text */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
                <p className="text-xs text-[var(--foreground-muted)] mb-1 font-medium uppercase tracking-wide">
                  {t("admin.email_templates.preview_text", "Plain Text")}
                </p>
                <pre className="text-xs text-[var(--foreground)] whitespace-pre-wrap font-mono">
                  {preview.text}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toasts */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert severity="success" onClose={() => setToastOpen(false)}>
          {t("admin.save_success", "Changes saved successfully")}
        </MuiAlert>
      </Snackbar>

      <Snackbar
        open={toastTestOpen}
        autoHideDuration={4000}
        onClose={() => setToastTestOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert severity="success" onClose={() => setToastTestOpen(false)}>
          {t("admin.email_templates.test_sent", "Test email sent to your address.")}
        </MuiAlert>
      </Snackbar>

      <Snackbar
        open={toastErrorOpen}
        autoHideDuration={5000}
        onClose={() => setToastErrorOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert severity="error" onClose={() => setToastErrorOpen(false)}>
          {errorMsg}
        </MuiAlert>
      </Snackbar>
    </div>
  );
}
