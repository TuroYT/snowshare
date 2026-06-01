"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui";
import AccessLogTable, { type AccessLog } from "./AccessLogTable";

type ShareAccessLogsModalProps = {
  shareId: string;
  slug: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function ShareAccessLogsModal({
  shareId,
  slug,
  isOpen,
  onClose,
}: ShareAccessLogsModalProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/user/access-logs?shareId=${shareId}&page=${p}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs);
          setTotal(data.total);
        }
      } finally {
        setLoading(false);
      }
    },
    [shareId]
  );

  // Reset to first page each time the modal opens for a share.
  useEffect(() => {
    if (isOpen) setPage(1);
  }, [isOpen, shareId]);

  useEffect(() => {
    if (isOpen) fetchLogs(page);
  }, [isOpen, page, fetchLogs]);

  const totalPages = Math.ceil(total / 50);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("profile.access_logs.share_title", "Accesses to /{{slug}}", { slug })}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--foreground-muted)]">
          {t("profile.access_logs.total", "{{count}} accesses", { count: total })}
        </p>
        <AccessLogTable
          logs={logs}
          loading={loading}
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          showShareColumn={false}
        />
      </div>
    </Modal>
  );
}
