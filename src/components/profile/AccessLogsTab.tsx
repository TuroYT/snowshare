"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import IpGeoModal from "@/components/admin/IpGeoModal";

interface IpGeoData {
  countryCode: string | null;
  countryName: string | null;
  continentCode: string | null;
  continentName: string | null;
  stateProv: string | null;
  city: string | null;
  status: string;
}

interface AccessLogEntry {
  id: string;
  shareId: string;
  slug: string;
  shareType: "FILE" | "PASTE" | "URL";
  ip: string;
  userAgent: string | null;
  accessedAt: string;
  geo: IpGeoData | null;
}

function countryCodeToFlagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return "\u2753";
  const code = countryCode.toUpperCase();
  const offset = 0x1f1e6 - 65;
  return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
}

const TYPE_LABELS: Record<string, string> = {
  FILE: "File",
  PASTE: "Paste",
  URL: "Link",
};

const TYPE_COLORS: Record<string, string> = {
  FILE: "bg-blue-900/30 text-blue-300 border-blue-700",
  PASTE: "bg-green-900/30 text-green-300 border-green-700",
  URL: "bg-purple-900/30 text-purple-300 border-purple-700",
};

interface AccessLogsTabProps {
  shares: { id: string; slug: string; type: string }[];
}

export default function AccessLogsTab({ shares }: AccessLogsTabProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedShareId, setSelectedShareId] = useState<string>("");
  const [geoModalOpen, setGeoModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AccessLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (selectedShareId) {
        params.set("shareId", selectedShareId);
      }

      const response = await fetch(`/api/user/shares/access-logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch access logs");

      const data = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error("Error fetching access logs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, selectedShareId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleShareFilter = (shareId: string) => {
    setSelectedShareId(shareId);
    setPage(1);
  };

  const handleIpClick = (log: AccessLogEntry) => {
    setSelectedLog(log);
    setGeoModalOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const startEntry = (page - 1) * 20 + 1;
  const endEntry = Math.min(page * 20, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            {t("access_logs.title")}
          </h3>
          <p className="text-sm text-[var(--foreground-muted)]">
            {t("access_logs.description")}
          </p>
        </div>
        <div className="text-sm text-[var(--foreground-muted)]">
          {t("access_logs.total_entries", { count: total })}
        </div>
      </div>

      {/* Filter by share */}
      <div className="flex flex-wrap gap-2">
        <select
          value={selectedShareId}
          onChange={(e) => handleShareFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="">{t("access_logs.filter_all_shares")}</option>
          {shares.map((share) => (
            <option key={share.id} value={share.id}>
              {share.slug} ({TYPE_LABELS[share.type] || share.type})
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--foreground-muted)]">
                {t("access_logs.table.type")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--foreground-muted)]">
                {t("access_logs.table.slug")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--foreground-muted)]">
                {t("access_logs.table.ip")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--foreground-muted)]">
                {t("access_logs.table.accessed_at")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--foreground-muted)]">
                {t("access_logs.table.user_agent")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--foreground-muted)]">
                  {t("loading")}
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--foreground-muted)]">
                  {t("access_logs.no_logs")}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-[var(--surface)]/50 transition-colors">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${
                        TYPE_COLORS[log.shareType] || ""
                      }`}
                    >
                      {TYPE_LABELS[log.shareType] || log.shareType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/${log.shareType === "FILE" ? "f" : log.shareType === "PASTE" ? "p" : "l"}/${log.slug}`}
                      className="text-[var(--primary)] hover:underline font-mono text-xs"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {log.slug}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleIpClick(log)}
                      className="text-[var(--primary)] hover:underline font-mono text-xs cursor-pointer"
                      title={t("access_logs.click_for_geo")}
                    >
                      {log.geo?.countryCode
                        ? `${countryCodeToFlagEmoji(log.geo.countryCode)} `
                        : ""}
                      {log.ip}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground-muted)] text-xs whitespace-nowrap">
                    {formatDate(log.accessedAt)}
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground-muted)] text-xs max-w-[200px] truncate" title={log.userAgent || ""}>
                    {log.userAgent
                      ? log.userAgent.length > 50
                        ? log.userAgent.substring(0, 50) + "..."
                        : log.userAgent
                      : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--foreground-muted)]">
            {t("access_logs.pagination_info", { start: startEntry, end: endEntry, total })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface)] transition-colors"
            >
              {t("access_logs.previous")}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface)] transition-colors"
            >
              {t("access_logs.next")}
            </button>
          </div>
        </div>
      )}

      {/* Geo Modal */}
      {selectedLog && (
        <IpGeoModal
          isOpen={geoModalOpen}
          onClose={() => {
            setGeoModalOpen(false);
            setSelectedLog(null);
          }}
          ip={selectedLog.ip}
          geoData={selectedLog.geo}
        />
      )}
    </div>
  );
}
