"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import WaveSkeleton from "@/components/ui/WaveSkeleton";
import IpGeoModal from "@/components/admin/IpGeoModal";
import LogRow from "@/components/admin/LogRow";
import WarningModal from "@/components/admin/WarningModal";
import { toast } from "@/components/ui/Toast";
import { Alert, Button, Input } from "@/components/ui";

interface IpGeoData {
  countryCode: string | null;
  countryName: string | null;
  continentCode: string | null;
  continentName: string | null;
  stateProv: string | null;
  city: string | null;
  status: string;
}

export interface LogEntry {
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

export default function LogsTab() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const skeletonRowIds = Array.from({ length: pagination.limit }, (_, n) => `skeleton-row-${n}`);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [geoModalOpen, setGeoModalOpen] = useState(false);
  const [selectedGeoLog, setSelectedGeoLog] = useState<LogEntry | null>(null);
  const [logToDelete, setLogToDelete] = useState<LogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
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
      setFetchError(t("admin.error_load_data"));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, typeFilter, search, t]);

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
    setLogToDelete(null);
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
      toast.error(t("admin.logs.delete_error"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <WarningModal
        open={logToDelete !== null}
        title={t("admin.logs.title")}
        message={logToDelete ? t("admin.logs.confirm_delete", { slug: logToDelete.slug }) : ""}
        onConfirm={() => logToDelete && handleDelete(logToDelete)}
        onCancel={() => setLogToDelete(null)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {t("admin.logs.title")}
          </h2>
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
            <Input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("admin.logs.search_placeholder")}
              aria-label={t("admin.logs.search_placeholder")}
              className="pl-10"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)] pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </form>

        {/* Type Filter */}
        <div className="flex flex-wrap gap-2">
          {["all", "FILE", "PASTE", "URL"].map((type) => (
            <Button
              key={type}
              type="button"
              variant={typeFilter === type ? "primary" : "secondary"}
              aria-pressed={typeFilter === type}
              onClick={() => handleTypeChange(type)}
            >
              {type === "all"
                ? t("admin.logs.filter_all")
                : t(`admin.logs.filter_${type.toLowerCase()}`)}
            </Button>
          ))}
        </div>
      </div>

      {fetchError && <Alert variant="danger">{fetchError}</Alert>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
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
          <tbody
            key={loading ? "loading" : "loaded"}
            className="animate-fade-in divide-y divide-[var(--border)]"
          >
            {loading &&
              skeletonRowIds.map((id) => (
                <tr key={id}>
                  <td className="py-3 px-4">
                    <WaveSkeleton
                      variant="rounded"
                      width={64}
                      height={26}
                      sx={{ borderRadius: "9999px" }}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <WaveSkeleton variant="rounded" width={80} height={26} />
                  </td>
                  <td className="py-3 px-4">
                    <WaveSkeleton variant="text" width={112} height={20} />
                  </td>
                  <td className="py-3 px-4">
                    <WaveSkeleton variant="text" width={96} height={20} />
                  </td>
                  <td className="py-3 px-4">
                    <WaveSkeleton variant="text" width={112} height={20} />
                  </td>
                  <td className="py-3 px-4">
                    <WaveSkeleton variant="text" width={112} height={20} />
                  </td>
                  <td className="py-3 px-4">
                    <WaveSkeleton
                      variant="rounded"
                      width={64}
                      height={22}
                      sx={{ borderRadius: "9999px" }}
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <WaveSkeleton variant="rounded" width={64} height={30} sx={{ ml: "auto" }} />
                  </td>
                </tr>
              ))}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--foreground-muted)]">
                  {t("admin.logs.no_logs")}
                </td>
              </tr>
            )}
            {!loading &&
              logs.length > 0 &&
              logs.map((log) => (
                <LogRow
                  key={log.id}
                  log={log}
                  deleting={deletingId === log.id}
                  onShowGeo={(entry) => {
                    setSelectedGeoLog(entry);
                    setGeoModalOpen(true);
                  }}
                  onDelete={setLogToDelete}
                />
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border)]">
          <div className="text-sm text-[var(--foreground-muted)]">
            {t("admin.logs.pagination_info", {
              start: (pagination.page - 1) * pagination.limit + 1,
              end: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
            >
              {t("admin.logs.previous")}
            </Button>
            <span className="px-3 py-1.5 text-sm text-[var(--foreground-muted)]">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
            >
              {t("admin.logs.next")}
            </Button>
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
