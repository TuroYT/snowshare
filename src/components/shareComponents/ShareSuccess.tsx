"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";

interface ShareSuccessProps {
  url: string;
  slug: string;
  /** i18n prefix for translation keys (e.g. "linkshare", "fileshare") */
  translationPrefix: string;
}

function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) return false;
  const domain = email.slice(atIndex + 1);
  return (
    domain.length > 0 && domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".")
  );
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const ShareSuccess: React.FC<ShareSuccessProps> = ({ url, slug, translationPrefix }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState<number>(150);

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [emailError, setEmailError] = useState("");

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copying to clipboard:", err);
    }
  };

  useEffect(() => {
    const update = () => {
      try {
        const w = window.innerWidth;
        if (w < 480) setQrSize(110);
        else if (w < 640) setQrSize(140);
        else if (w < 1024) setQrSize(160);
        else setQrSize(200);
      } catch {
        setQrSize(150);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    async function checkFeatures() {
      try {
        const [settingsRes, sessionRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/auth/session"),
        ]);
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setEmailEnabled(!!data.settings?.emailEnabled);
        }
        if (sessionRes.ok) {
          const session = await sessionRes.json();
          setIsAuthenticated(!!session?.user?.id);
        }
      } catch {
        // silently ignore — email section simply won't show
      }
    }
    checkFeatures();
  }, []);

  const handleSendEmail = async () => {
    setEmailError("");
    const recipients = parseRecipients(recipientsRaw);
    const invalid = recipients.length === 0 || recipients.some((r) => !isValidEmail(r));
    if (invalid) {
      setEmailError(
        t("share_email.error_invalid", "Please enter at least one valid email address.")
      );
      return;
    }

    setEmailStatus("sending");
    try {
      const res = await fetch("/api/shares/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, recipients }),
      });
      if (res.ok) {
        setEmailStatus("success");
        setRecipientsRaw("");
      } else {
        setEmailStatus("error");
        setEmailError(t("share_email.error_send", "Failed to send email. Please try again."));
      }
    } catch {
      setEmailStatus("error");
      setEmailError(t("share_email.error_send", "Failed to send email. Please try again."));
    }
  };

  return (
    <div role="status" className="mt-6 bg-green-900/20 border border-green-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-green-300 mb-2">
            {t(`${translationPrefix}.success_title`, "Partage créé avec succès !")}
          </h4>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1 min-w-0">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] underline break-all"
              >
                {url}
              </a>
              {copied && (
                <p className="text-xs text-green-400 mt-2">
                  {t(`${translationPrefix}.copied`, "✓ Copié dans le presse-papiers")}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 flex items-start gap-2">
              <button
                onClick={() => copyToClipboard(url)}
                className="p-2 text-[var(--foreground-muted)] hover:text-white hover:bg-[var(--surface)] rounded transition-colors"
                title={t(`${translationPrefix}.copy_title`, "Copier le lien")}
              >
                {copied ? (
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Email sending section — only shown when SMTP is enabled and user is logged in */}
          {emailEnabled && isAuthenticated && (
            <div className="mt-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">
                {t("share_email.section_title", "Send by email")}
              </p>
              <label htmlFor="share-email-recipients" className="sr-only">
                {t("share_email.recipients_label", "Recipients (comma-separated)")}
              </label>
              <div className="flex gap-2">
                <input
                  id="share-email-recipients"
                  type="text"
                  value={recipientsRaw}
                  onChange={(e) => {
                    setRecipientsRaw(e.target.value);
                    if (emailStatus !== "idle") setEmailStatus("idle");
                    setEmailError("");
                  }}
                  placeholder={t(
                    "share_email.recipients_placeholder",
                    "alice@example.com, bob@example.com"
                  )}
                  className="flex-1 px-3 py-2 text-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--foreground-muted)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-colors"
                  disabled={emailStatus === "sending"}
                />
                <button
                  onClick={handleSendEmail}
                  disabled={emailStatus === "sending" || !recipientsRaw.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {emailStatus === "sending" ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      {t("share_email.sending", "Sending...")}
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      {t("share_email.send_button", "Send")}
                    </>
                  )}
                </button>
              </div>
              {emailError && <p className="mt-2 text-xs text-red-400">{emailError}</p>}
              {emailStatus === "success" && (
                <p className="mt-2 text-xs text-green-400">
                  {t("share_email.success", "Email sent successfully!")}
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-center">
            <div className="flex flex-col items-center bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50">
              <p className="text-sm text-[var(--foreground)] mb-2 text-center">
                {t(`${translationPrefix}.qr_info`, "Scanner ce QR code pour accéder au partage")}
              </p>
              <div className="bg-white rounded p-2" style={{ width: qrSize, height: qrSize }}>
                <QRCodeSVG value={url} size={qrSize - 16} className="block" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareSuccess;
