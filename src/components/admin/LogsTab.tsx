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

interface LogEntry {
  id: string;
  type: "FILE" | "PASTE" | "URL";
  slug: string;
  createdAt: string;
  expiresAt: string | null;
  ipSource: string | null;
  hasPassword: boolean;
  maxViews: number | null;
  viewCount: number;
  owner: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  ipGeo: IpGeoData | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function countryCodeToFlagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return "\u2753";
  const code = countryCode.toUpperCase();
  const offset = 0x1f1e6 - 65;
  return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
}

export default function LogsTab() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [geoModalOpen, setGeoModalOpen] = useState(false);
  const [selectedGeoLog, setSelectedGeoLog] = useState<LogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        type: typeFilter,
        search: search,
      });

      const response = await fetch(`/api/admin/logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch logs");

      const data = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, typeFilter, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleTypeChange = (type: string) => {
    setTypeFilter(type);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleDelete = async (log: LogEntry) => {
    const confirmed = window.confirm(t("admin.logs.confirm_delete", { slug: log.slug }));
    if (!confirmed) return;

    setDeletingId(log.id);
    try {
      const response = await fetch(`/api/admin/logs/${log.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete share");
      }

      setPagination((prev) => {
        const total = Math.max(prev.total - 1, 0);
        const totalPages = Math.max(Math.ceil(total / prev.limit), 1);
        const page = Math.min(prev.page, totalPages);
        return { ...prev, total, totalPages, page };
      });

      // If we stayed on the same page, refresh immediately; otherwise the pagination change triggers a fetch
      if (!(logs.length === 1 && pagination.page > 1)) {
        await fetchLogs();
      }
    } catch (error) {
      console.error("Error deleting share:", error);
      alert(t("admin.logs.delete_error"));
    } finally {
      setDeletingId(null);
    }
  };

  const getTypeUrl = (type: string, slug: string) => {
    switch (type) {
      case "FILE":
        return `/f/${slug}`;
      case "PASTE":
        return `/p/${slug}`;
      case "URL":
        return `/l/${slug}`;
      default:
        return "#";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "FILE":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case "PASTE":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case "URL":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "FILE":
        return "bg-[var(--secondary)]/20 text-[var(--secondary)] border-purple-500/30";
      case "PASTE":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "URL":
        return "bg-[var(--primary)]/20 text-[var(--primary)] border-blue-500/30";
      default:
        return "bg-gray-500/20 text-[var(--foreground-muted)] border-gray-500/30";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isViewLimitReached = (maxViews: number | null, viewCount: number) => {
    if (maxViews === null || maxViews === undefined) return false;
    return viewCount >= maxViews;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("admin.logs.title")}</h2>
          <p className="text-sm text-[var(--foreground-muted)]">
            {t("admin.logs.total_shares", { count: pagination.total })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("admin.logs.search_placeholder")}
              className="w-full bg-[var(--surface)]/50 border border-[var(--border)] rounded-lg px-4 py-2 pl-10 text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        {/* Type Filter */}
        <div className="flex gap-2">
          {["all", "FILE", "PASTE", "URL"].map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === type
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--surface)]/50 text-[var(--foreground-muted)] hover:text-[var(--foreground)] border border-[var(--border)]"
              }`}
            >
              {type === "all" ? t("admin.logs.filter_all") : t(`admin.logs.filter_${type.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]/50">
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                {t("admin.logs.table.type")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                {t("admin.logs.table.slug")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                {t("admin.logs.table.owner")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                {t("admin.logs.table.ip")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                {t("admin.logs.table.created")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                {t("admin.logs.table.expires")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                {t("admin.logs.table.status")}
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                {t("admin.logs.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--foreground-muted)]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    <span suppressHydrationWarning>{t("loading")}</span>
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--foreground-muted)]">
                  {t("admin.logs.no_logs")}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-[var(--surface)]/30 transition-colors">
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeBadgeColor(log.type)}`}>
                      {getTypeIcon(log.type)}
                      {log.type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <code className="text-sm text-[var(--foreground)] bg-[var(--surface)] px-2 py-1 rounded">
                      <a href={getTypeUrl(log.type, log.slug)} target="_blank" rel="noopener noreferrer">
                        {log.slug}
                      </a>
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    {log.owner ? (
                      <div className="text-sm">
                        <div className="text-[var(--foreground)]">{log.owner.name || log.owner.email}</div>
                        {log.owner.name && (
                          <div className="text-[var(--foreground-muted)] text-xs">{log.owner.email}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[var(--foreground-muted)] text-sm italic">{t("admin.logs.anonymous")}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {log.ipSource && (
                        <button
                          onClick={() => {
                            setSelectedGeoLog(log);
                            setGeoModalOpen(true);
                          }}
                          className="cursor-pointer hover:scale-110 transition-transform"
                          title={
                            log.ipGeo?.status === "resolved"
                              ? log.ipGeo.countryName || ""
                              : t("admin.logs.geo.unknown")
                          }
                        >
                          <span className="text-lg">
                            {log.ipGeo?.status === "resolved"
                              ? countryCodeToFlagEmoji(log.ipGeo.countryCode)
                              : "\u2753"}
                          </span>
                        </button>
                      )}
                      <span className="text-sm text-[var(--foreground-muted)] font-mono">
                        {log.ipSource || "-"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-[var(--foreground)]">{formatDate(log.createdAt)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-[var(--foreground-muted)]">
                      {log.expiresAt ? formatDate(log.expiresAt) : t("admin.logs.never")}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isExpired(log.expiresAt) || isViewLimitReached(log.maxViews, log.viewCount) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                          {t("admin.logs.expired")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          {t("admin.logs.active")}
                        </span>
                      )}
                      {log.maxViews && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30" title={`${log.viewCount}/${log.maxViews} views`}>
                          👁️ {log.viewCount}/{log.maxViews}
                        </span>
                      )}
                      {log.hasPassword && (
                        <span title={t("admin.logs.password_protected")}>
                          <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(log)}
                      disabled={deletingId === log.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600/10 text-red-400 border border-red-500/30 hover:bg-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {deletingId === log.id ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400" aria-hidden />
                          {t("admin.logs.deleting")}
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v2M4 7h16" />
                          </svg>
                          {t("admin.logs.delete")}
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]/50">
          <div className="text-sm text-[var(--foreground-muted)]">
            {t("admin.logs.pagination_info", {
              start: (pagination.page - 1) * pagination.limit + 1,
              end: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 rounded bg-[var(--surface)]/50 border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("admin.logs.previous")}
            </button>
            <span className="px-3 py-1 text-[var(--foreground-muted)]">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 rounded bg-[var(--surface)]/50 border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("admin.logs.next")}
            </button>
          </div>
        </div>
      )}

      {/* IP Geolocation Modal */}
      {selectedGeoLog && (
        <IpGeoModal
          isOpen={geoModalOpen}
          onClose={() => {
            setGeoModalOpen(false);
            setSelectedGeoLog(null);
          }}
          ip={selectedGeoLog.ipSource || ""}
          geoData={selectedGeoLog.ipGeo}
        />
      )}
    </div>
  );
}
