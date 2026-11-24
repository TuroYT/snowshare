"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Input, Spinner, Tab, Tabs, Textarea } from "@/components/ui";
import WaveSkeleton from "@/components/ui/WaveSkeleton";
import { toast } from "@/components/ui/Toast";
import { useTranslation } from "react-i18next";

type EmailType = "share" | "verify" | "reset";

interface EmailTemplates {
  shareEmailSubject: string | null;
  shareEmailHtml: string | null;
  shareEmailText: string | null;
  verifyEmailSubject: string | null;
  verifyEmailHtml: string | null;
  verifyEmailText: string | null;
  resetEmailSubject: string | null;
  resetEmailHtml: string | null;
  resetEmailText: string | null;
}

interface DefaultTemplates {
  shareEmailSubject: string;
  shareEmailHtml: string;
  shareEmailText: string;
  verifyEmailSubject: string;
  verifyEmailHtml: string;
  verifyEmailText: string;
  resetEmailSubject: string;
  resetEmailHtml: string;
  resetEmailText: string;
}

interface PreviewResult {
  subject: string;
  html: string;
  text: string;
}

/** The template columns behind each email type */
const TEMPLATE_KEYS = {
  share: { subject: "shareEmailSubject", html: "shareEmailHtml", text: "shareEmailText" },
  verify: { subject: "verifyEmailSubject", html: "verifyEmailHtml", text: "verifyEmailText" },
  reset: { subject: "resetEmailSubject", html: "resetEmailHtml", text: "resetEmailText" },
} as const satisfies Record<EmailType, Record<"subject" | "html" | "text", keyof EmailTemplates>>;

const TYPE_LABELS: Record<EmailType, { key: string; fallback: string }> = {
  share: { key: "admin.email_templates.type_share", fallback: "Share Email" },
  verify: { key: "admin.email_templates.type_verify", fallback: "Verification Email" },
  reset: { key: "admin.email_templates.type_reset", fallback: "Password Reset Email" },
};

export default function EmailTemplatesTab() {
  const { t } = useTranslation();
  const [activeType, setActiveType] = useState<EmailType>("share");
  const [templates, setTemplates] = useState<EmailTemplates>({
    shareEmailSubject: null,
    shareEmailHtml: null,
    shareEmailText: null,
    verifyEmailSubject: null,
    verifyEmailHtml: null,
    verifyEmailText: null,
    resetEmailSubject: null,
    resetEmailHtml: null,
    resetEmailText: null,
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

  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
      toast.error(t("admin.email_templates.error_load", "Failed to load email templates."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (!defaults) return;
    const fields = TEMPLATE_KEYS[activeType];
    setSubject(templates[fields.subject] ?? defaults[fields.subject]);
    setHtml(templates[fields.html] ?? defaults[fields.html]);
    setText(templates[fields.text] ?? defaults[fields.text]);
  }, [activeType, templates, defaults]);

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

  // srcdoc is set imperatively so typing does not remount the iframe
  useEffect(() => {
    if (iframeRef.current && preview?.html) {
      iframeRef.current.srcdoc = preview.html;
    }
  }, [preview?.html]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const fields = TEMPLATE_KEYS[activeType];
      const patchData: Partial<EmailTemplates> = {
        [fields.subject]: subject || null,
        [fields.html]: html || null,
        [fields.text]: text || null,
      };

      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });

      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setTemplates((prev) => ({ ...prev, ...data.templates }));
      toast.success(t("admin.save_success", "Changes saved successfully"));
    } catch (err) {
      console.error(err);
      toast.error(t("admin.save_error", "Error saving changes"));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!defaults) return;
    setSaving(true);
    try {
      const fields = TEMPLATE_KEYS[activeType];
      const patchData: Partial<EmailTemplates> = {
        [fields.subject]: null,
        [fields.html]: null,
        [fields.text]: null,
      };

      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });
      if (!res.ok) throw new Error("Reset failed");
      const data = await res.json();
      setTemplates((prev) => ({ ...prev, ...data.templates }));
      toast.success(t("admin.save_success", "Changes saved successfully"));
    } catch (err) {
      console.error(err);
      toast.error(t("admin.save_error", "Error saving changes"));
    } finally {
      setSaving(false);
    }
  };

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
      toast.success(t("admin.email_templates.test_sent", "Test email sent to your address."));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || t("admin.email_templates.test_error", "Failed to send test email."));
    } finally {
      setTestSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <WaveSkeleton variant="text" width={200} height={28} />
        <WaveSkeleton variant="rounded" height={42} />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <WaveSkeleton variant="rounded" height={420} />
          <WaveSkeleton variant="rounded" height={420} />
        </div>
      </div>
    );
  }

  const emailTypes = Object.keys(TEMPLATE_KEYS) as EmailType[];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          {t("admin.email_templates.title", "Email Templates")}
        </h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          {t(
            "admin.email_templates.description",
            "Customize the HTML/text content and subject line of outgoing emails. Use {{appName}}, {{shareTitle}}, {{shareUrl}}, {{verifyUrl}}, or {{resetUrl}} as placeholders."
          )}
        </p>
      </div>

      <Tabs
        value={activeType}
        onValueChange={(v) => setActiveType(v as EmailType)}
        className="mb-6"
      >
        {emailTypes.map((type) => (
          <Tab key={type} value={type}>
            {t(TYPE_LABELS[type].key, TYPE_LABELS[type].fallback)}
          </Tab>
        ))}
      </Tabs>

      <div
        role="tabpanel"
        id={`tabpanel-${activeType}`}
        aria-labelledby={`tab-${activeType}`}
        className="grid grid-cols-1 xl:grid-cols-2 gap-6"
      >
        <div className="space-y-4">
          <Input
            label={t("admin.email_templates.subject", "Subject")}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("admin.email_templates.subject_placeholder", "Email subject…")}
          />

          <Textarea
            label={t("admin.email_templates.html_body", "HTML Body")}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={14}
            spellCheck={false}
            className="text-xs font-mono resize-y"
            placeholder="<div>…</div>"
          />

          <Textarea
            label={t("admin.email_templates.text_body", "Plain Text Body")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            spellCheck={false}
            className="text-xs font-mono resize-y"
            placeholder={t("admin.email_templates.text_placeholder", "Plain text fallback…")}
          />

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={handleSave} isLoading={saving}>
              {saving ? t("admin.email_templates.saving", "Saving…") : t("common.save", "Save")}
            </Button>
            <Button type="button" variant="secondary" onClick={handleReset} disabled={saving}>
              {t("admin.email_templates.reset_defaults", "Reset to defaults")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSendTest}
              isLoading={testSending}
            >
              {testSending
                ? t("admin.email_templates.sending_test", "Sending…")
                : t("admin.email_templates.send_test", "Send test email")}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              {t("admin.email_templates.preview_title", "Live Preview")}
            </h3>
            <span className="h-5 flex items-center">{previewLoading && <Spinner size="sm" />}</span>
          </div>

          {preview && (
            <>
              <div className="border border-[var(--border)] rounded-[var(--radius)] p-3">
                <p className="text-xs text-[var(--foreground-muted)] mb-1 font-medium uppercase tracking-wide">
                  {t("admin.email_templates.preview_subject", "Subject")}
                </p>
                <p className="text-sm text-[var(--foreground)]">{preview.subject}</p>
              </div>

              <div className="rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
                <p className="text-xs text-[var(--foreground-muted)] bg-[var(--surface-hover)] px-3 py-1.5 border-b border-[var(--border)] font-medium uppercase tracking-wide">
                  {t("admin.email_templates.preview_html", "HTML")}
                </p>
                <iframe
                  ref={iframeRef}
                  title={t("admin.email_templates.preview_title", "Live Preview")}
                  sandbox="allow-same-origin"
                  className="w-full border-0 bg-white"
                  style={{ height: "380px" }}
                />
              </div>

              <div className="border border-[var(--border)] rounded-[var(--radius)] p-3">
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
    </div>
  );
}
