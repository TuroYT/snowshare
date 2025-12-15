"use client";

import { memo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

// Dynamically import QRCodeSVG only when needed
let QRCodeSVG: any = null;

interface LazyQRCodeProps {
  value: string;
  size: number;
}

function LazyQRCode({ value, size }: LazyQRCodeProps) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Only load QR code library when component mounts
    import("qrcode.react")
      .then((module) => {
        QRCodeSVG = module.QRCodeSVG;
        setLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load QR code library:", err);
        setError(true);
      });
  }, []);

  if (error) {
    return (
      <div 
        className="flex items-center justify-center bg-[var(--surface)]/50 rounded"
        style={{ width: size, height: size }}
      >
        <p className="text-xs text-[var(--foreground-muted)] text-center px-4">
          {t("qr.load_error", "QR code unavailable")}
        </p>
      </div>
    );
  }

  if (!loaded || !QRCodeSVG) {
    return (
      <div 
        className="flex items-center justify-center bg-[var(--surface)]/50 rounded animate-pulse"
        style={{ width: size, height: size }}
      >
        <div className="text-xs text-[var(--foreground-muted)]">
          {t("qr.loading", "Loading...")}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded p-2" style={{ width: size, height: size }}>
      <QRCodeSVG value={value} size={size - 16} className="block" />
    </div>
  );
}

export default memo(LazyQRCode);
