"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

type AccessLog = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  accessedAt: string;
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

const TYPE_BADGE: Record<string, string> = {
  FILE: "bg-blue-500/20 text-blue-300",
  PASTE: "bg-purple-500/20 text-purple-300",
  URL: "bg-green-500/20 text-green-300",
};

export default function AccessLogs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/user/access-logs?page=${p}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(page);
  }, [page, fetchLogs]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {t("profile.access_logs.title", "Access Logs")}
        </h2>
        <span className="text-sm text-[var(--foreground-muted)]">
          {t("profile.access_logs.total", "{{count}} accesses", { count: total })}
        </span>
      </div>

      <p className="text-sm text-[var(--foreground-muted)]">
        {t("profile.access_logs.description", "Each time one of your shares is accessed, it is recorded here.")}
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-[var(--primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-[var(--foreground-muted)] border border-dashed border-[var(--border)] rounded-lg">
          {t("profile.access_logs.empty", "No accesses recorded yet.")}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <th className="px-4 py-3 text-left text-[var(--foreground-muted)] font-medium">
                    {t("profile.access_logs.col_share", "Share")}
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--foreground-muted)] font-medium">
                    {t("profile.access_logs.col_ip", "IP")}
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--foreground-muted)] font-medium hidden md:table-cell">
                    {t("profile.access_logs.col_user_agent", "User Agent")}
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--foreground-muted)] font-medium">
                    {t("profile.access_logs.col_date", "Date")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_BADGE[log.share.type]}`}>
                          {log.share.type}
                        </span>
                        <a
                          href={`${SHARE_PREFIX[log.share.type]}${log.share.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--primary)] hover:underline font-mono text-xs"
                        >
                          {log.share.slug}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--foreground)]">
                      {log.ip ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
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
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--foreground)] disabled:opacity-40 hover:bg-[var(--surface)] transition-colors"
              >
                {t("profile.access_logs.prev", "Previous")}
              </button>
              <span className="text-sm text-[var(--foreground-muted)]">
                {t("profile.access_logs.page", "Page {{page}} / {{total}}", { page, total: totalPages })}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--foreground)] disabled:opacity-40 hover:bg-[var(--surface)] transition-colors"
              >
                {t("profile.access_logs.next", "Next")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
