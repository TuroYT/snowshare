"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import AccessLogTable, { type AccessLog } from "./AccessLogTable";

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
        {t(
          "profile.access_logs.description",
          "Each time one of your shares is accessed, it is recorded here."
        )}
      </p>

      <AccessLogTable
        logs={logs}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
