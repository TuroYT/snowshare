"use client";

import Modal from "@/components/ui/Modal";
import { useTranslation } from "react-i18next";

interface IpGeoData {
  countryCode: string | null;
  countryName: string | null;
  continentCode: string | null;
  continentName: string | null;
  stateProv: string | null;
  city: string | null;
  status: string;
}

interface IpGeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  ip: string;
  geoData: IpGeoData | null;
}

function countryCodeToFlagEmoji(
  countryCode: string | null | undefined
): string {
  if (!countryCode || countryCode.length !== 2) {
    return "\u2753";
  }
  const code = countryCode.toUpperCase();
  const offset = 0x1f1e6 - 65;
  return String.fromCodePoint(
    code.charCodeAt(0) + offset,
    code.charCodeAt(1) + offset
  );
}

export default function IpGeoModal({
  isOpen,
  onClose,
  ip,
  geoData,
}: IpGeoModalProps) {
  const { t } = useTranslation();

  const isResolved = geoData?.status === "resolved";
  const flag = countryCodeToFlagEmoji(geoData?.countryCode);

  const rows = [
    { label: t("admin.logs.geo.ip_address"), value: ip },
    {
      label: t("admin.logs.geo.country"),
      value: isResolved
        ? `${flag} ${geoData?.countryName}`
        : t("admin.logs.geo.unknown"),
    },
    {
      label: t("admin.logs.geo.country_code"),
      value: geoData?.countryCode || "-",
    },
    {
      label: t("admin.logs.geo.continent"),
      value: geoData?.continentName || "-",
    },
    {
      label: t("admin.logs.geo.continent_code"),
      value: geoData?.continentCode || "-",
    },
    {
      label: t("admin.logs.geo.state_province"),
      value: geoData?.stateProv || "-",
    },
    { label: t("admin.logs.geo.city"), value: geoData?.city || "-" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("admin.logs.geo.modal_title")}
      size="sm"
    >
      <div className="space-y-3">
        {/* Large flag display */}
        <div className="text-center py-4">
          <span className="text-6xl">{flag}</span>
          {isResolved && geoData?.countryName && (
            <p className="text-lg font-semibold text-[var(--foreground)] mt-2">
              {geoData.countryName}
            </p>
          )}
          {!isResolved && (
            <p className="text-sm text-[var(--foreground-muted)] mt-2">
              {t("admin.logs.geo.not_resolved")}
            </p>
          )}
        </div>

        {/* Detail rows */}
        <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex justify-between items-center px-4 py-3"
            >
              <span className="text-sm text-[var(--foreground-muted)]">
                {row.label}
              </span>
              <span className="text-sm font-medium text-[var(--foreground)]">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
