"use client";

import { useState, useEffect } from "react";
import type { AccessLog } from "@/components/profile/AccessLogTable";

type UseAccessLogsOptions = {
  shareId?: string;
};

const PAGE_SIZE = 50;

export function useAccessLogs({ shareId }: UseAccessLogsOptions = {}) {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const url = shareId
      ? `/api/user/access-logs?shareId=${shareId}&page=${page}`
      : `/api/user/access-logs?page=${page}`;

    setLoading(true);
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch access logs:", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, shareId]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return { logs, total, page, setPage, loading, totalPages };
}
