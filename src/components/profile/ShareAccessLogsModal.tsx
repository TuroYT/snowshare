"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui";
import { useAccessLogs } from "@/hooks/useAccessLogs";
import AccessLogTable from "./AccessLogTable";

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
  const { logs, total, page, setPage, loading, totalPages } = useAccessLogs({ shareId });

  // Reset to first page each time the modal opens.
  useEffect(() => {
    if (isOpen) setPage(1);
  }, [isOpen, shareId, setPage]);

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
