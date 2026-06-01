"use client";

import { useState, useEffect, useCallback } from "react";
import type { AccessLog } from "@/components/profile/AccessLogTable";

type UseAccessLogsOptions = {
  shareId?: string;
};

export function useAccessLogs({ shareId }: UseAccessLogsOptions = {}) {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const url = shareId
          ? `/api/user/access-logs?shareId=${shareId}&page=${p}`
          : `/api/user/access-logs?page=${p}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs);
          setTotal(data.total);
        }
      } catch (err) {
        console.error("Failed to fetch access logs:", err);
      } finally {
        setLoading(false);
      }
    },
    [shareId]
  );

  useEffect(() => {
    fetchLogs(page);
  }, [page, fetchLogs]);

  const totalPages = Math.ceil(total / 50);

  return { logs, total, page, setPage, loading, totalPages };
}
