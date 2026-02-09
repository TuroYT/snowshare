"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";

interface ShareSuccessProps {
  url: string;
  /** i18n prefix for translation keys (e.g. "linkshare", "fileshare") */
  translationPrefix: string;
}

const ShareSuccess: React.FC<ShareSuccessProps> = ({
  url,
  translationPrefix,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState<number>(150);

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

  return (
    <div
      role="status"
      className="mt-6 bg-green-900/20 border border-green-800 rounded-lg p-4"
    >
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <div className="flex flex-col items-center bg-[var(--surface)]/50 p-4 rounded-xl border border-[var(--border)]/50">
              <p className="text-sm text-[var(--foreground)] mb-2 text-center">
                {t(
                  `${translationPrefix}.qr_info`,
                  "Scanner ce QR code pour accéder au partage"
                )}
              </p>
              <div
                className="bg-white rounded p-2"
                style={{ width: qrSize, height: qrSize }}
              >
                <QRCodeSVG
                  value={url}
                  size={qrSize - 16}
                  className="block"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareSuccess;
