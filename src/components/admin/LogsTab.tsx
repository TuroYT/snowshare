"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface LogEntry {
  id: string;
  type: "FILE" | "PASTE" | "URL";
  slug: string;
  createdAt: string;
  expiresAt: string | null;
  ipSource: string | null;
  hasPassword: boolean;
  owner: {
    id: string;
    email: string;
    name: string | null;
  } | null;
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
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

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
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "PASTE":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "URL":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">{t("admin.logs.title")}</h2>
          <p className="text-sm text-gray-400">
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
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 pl-10 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500"
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
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800/50 text-gray-400 hover:text-gray-300 border border-gray-700"
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
            <tr className="border-b border-gray-700/50">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {t("admin.logs.table.type")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {t("admin.logs.table.slug")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {t("admin.logs.table.owner")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {t("admin.logs.table.ip")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {t("admin.logs.table.created")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {t("admin.logs.table.expires")}
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {t("admin.logs.table.status")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    {t("loading")}
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  {t("admin.logs.no_logs")}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeBadgeColor(log.type)}`}>
                      {getTypeIcon(log.type)}
                      {log.type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <code className="text-sm text-gray-300 bg-gray-800 px-2 py-1 rounded">
                      <a href={getTypeUrl(log.type, log.slug)} target="_blank" rel="noopener noreferrer">
                        {log.slug}
                      </a>
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    {log.owner ? (
                      <div className="text-sm">
                        <div className="text-gray-200">{log.owner.name || log.owner.email}</div>
                        {log.owner.name && (
                          <div className="text-gray-500 text-xs">{log.owner.email}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm italic">{t("admin.logs.anonymous")}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-400 font-mono">
                      {log.ipSource || "-"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-300">{formatDate(log.createdAt)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-400">
                      {log.expiresAt ? formatDate(log.expiresAt) : t("admin.logs.never")}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {isExpired(log.expiresAt) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                          {t("admin.logs.expired")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          {t("admin.logs.active")}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
          <div className="text-sm text-gray-400">
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
              className="px-3 py-1 rounded bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("admin.logs.previous")}
            </button>
            <span className="px-3 py-1 text-gray-400">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 rounded bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("admin.logs.next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
