"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Spinner } from "@/components/ui";

function countryCodeToFlagEmoji(countryCode: string | null | undefined): string {
  if (countryCode?.length !== 2) return "❓";
  const code = countryCode.toUpperCase();
  const offset = 0x1f1e6 - 65;
  return String.fromCodePoint(
    (code.codePointAt(0) ?? 65) + offset,
    (code.codePointAt(1) ?? 65) + offset
  );
}

export type IpGeo = {
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  stateProv: string | null;
  status: string;
};

export type AccessLog = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  accessedAt: string;
  ipGeo: IpGeo | null;
  share: {
    slug: string;
    type: "FILE" | "PASTE" | "URL";
  };
};

const SHARE_PREFIX: Record<string, string> = {
  FILE: "/f/",
  PASTE: "/p/",
  URL: "/l/",
};

const TYPE_BADGE_VARIANT = {
  FILE: "muted",
  PASTE: "info",
  URL: "success",
} as const;

function GeoCell({ geo }: Readonly<{ geo: IpGeo | null }>) {
  if (!geo || geo.status === "pending") {
    return <span className="text-[var(--foreground-muted)]">—</span>;
  }
  if (geo.status === "unknown") {
    return <span className="text-[var(--foreground-muted)]">?</span>;
  }
  const flag = countryCodeToFlagEmoji(geo.countryCode);
  const location = [geo.city, geo.countryName].filter(Boolean).join(", ");
  return (
    <span
      className="flex items-center gap-1.5 text-xs text-[var(--foreground)]"
      title={[geo.city, geo.stateProv, geo.countryName].filter(Boolean).join(", ")}
    >
      <span aria-hidden="true">{flag}</span>
      <span className="truncate max-w-[120px]">{location || geo.countryCode}</span>
    </span>
  );
}

type AccessLogTableProps = {
  logs: AccessLog[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Show the "Share" column. Disable when the table is already scoped to a single share. */
  showShareColumn?: boolean;
};

export default function AccessLogTable({
  logs,
  loading,
  page,
  totalPages,
  onPageChange,
  showShareColumn = true,
}: Readonly<AccessLogTableProps>) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div
        className="flex justify-center py-10"
        role="status"
        aria-label={t("loading", "Loading...")}
      >
        <Spinner size="lg" className="h-8 w-8" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--foreground-muted)] border border-dashed border-[var(--border)] rounded-[var(--radius-lg)]">
        {t("profile.access_logs.empty", "No accesses recorded yet.")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-hover)]">
              {showShareColumn && (
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-[var(--foreground-muted)] font-medium"
                >
                  {t("profile.access_logs.col_share", "Share")}
                </th>
              )}
              <th
                scope="col"
                className="px-4 py-3 text-left text-[var(--foreground-muted)] font-medium"
              >
                {t("profile.access_logs.col_ip", "IP")}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-[var(--foreground-muted)] font-medium hidden sm:table-cell"
              >
                {t("profile.access_logs.col_location", "Location")}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-[var(--foreground-muted)] font-medium hidden lg:table-cell"
              >
                {t("profile.access_logs.col_user_agent", "User Agent")}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-[var(--foreground-muted)] font-medium"
              >
                {t("profile.access_logs.col_date", "Date")}
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] transition-colors duration-100"
              >
                {showShareColumn && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={TYPE_BADGE_VARIANT[log.share.type]}>{log.share.type}</Badge>
                      <a
                        href={`${SHARE_PREFIX[log.share.type]}${log.share.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--foreground)] hover:text-[var(--primary)] hover:underline font-mono text-xs"
                      >
                        {log.share.slug}
                      </a>
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 font-mono text-xs text-[var(--foreground)]">
                  {log.ip ?? "—"}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <GeoCell geo={log.ipGeo} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span
                    className="text-xs text-[var(--foreground-muted)] max-w-xs block truncate"
                    title={log.userAgent ?? undefined}
                  >
                    {log.userAgent ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] whitespace-nowrap">
                  {new Date(log.accessedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            {t("profile.access_logs.prev", "Previous")}
          </Button>
          <span className="text-sm text-[var(--foreground-muted)]">
            {t("profile.access_logs.page", "Page {{page}} / {{total}}", {
              page,
              total: totalPages,
            })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            {t("profile.access_logs.next", "Next")}
          </Button>
        </div>
      )}
    </div>
  );
}
