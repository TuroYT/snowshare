"use client";

import { useTranslation } from "react-i18next";
import { useAccessLogs } from "@/hooks/useAccessLogs";
import AccessLogTable from "./AccessLogTable";

export default function AccessLogs() {
  const { t } = useTranslation();
  const { logs, total, page, setPage, loading, totalPages } = useAccessLogs();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
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
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
