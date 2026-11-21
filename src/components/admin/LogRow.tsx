"use client";

import { useTranslation } from "react-i18next";
import { Badge, Button } from "@/components/ui";
import type { LogEntry } from "@/components/admin/LogsTab";

function countryCodeToFlagEmoji(countryCode: string | null | undefined): string {
  if (countryCode?.length !== 2) return "\u2753";
  const code = countryCode.toUpperCase();
  const offset = 0x1f1e6 - 65;
  return String.fromCodePoint(
    (code.codePointAt(0) ?? 65) + offset,
    (code.codePointAt(1) ?? 65) + offset
  );
}

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
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    case "PASTE":
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case "URL":
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      );
    default:
      return null;
  }
};

const getTypeBadgeVariant = (type: string) => {
  switch (type) {
    case "FILE":
      return "info";
    case "PASTE":
      return "success";
    default:
      return "muted";
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

function TypeCell({ log }: Readonly<{ log: LogEntry }>) {
  return (
    <td className="py-3 px-4">
      <Badge variant={getTypeBadgeVariant(log.type)} className="gap-1.5">
        {getTypeIcon(log.type)}
        {log.type}
      </Badge>
    </td>
  );
}

function SlugCell({ log }: Readonly<{ log: LogEntry }>) {
  return (
    <td className="py-3 px-4">
      <code className="text-sm text-[var(--foreground)] bg-[var(--surface-hover)] px-2 py-1 rounded">
        <a
          href={getTypeUrl(log.type, log.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          {log.slug}
        </a>
      </code>
    </td>
  );
}

function OwnerCell({ log }: Readonly<{ log: LogEntry }>) {
  const { t } = useTranslation();
  return (
    <td className="py-3 px-4">
      {log.owner ? (
        <div className="text-sm">
          <div className="text-[var(--foreground)]">{log.owner.name || log.owner.email}</div>
          {log.owner.name && (
            <div className="text-[var(--foreground-muted)] text-xs">{log.owner.email}</div>
          )}
        </div>
      ) : (
        <span className="text-[var(--foreground-muted)] text-sm italic">
          {t("admin.logs.anonymous")}
        </span>
      )}
    </td>
  );
}

function GeoCell({
  log,
  onShowGeo,
}: Readonly<{ log: LogEntry; onShowGeo: (log: LogEntry) => void }>) {
  const { t } = useTranslation();
  const geo = log.ipGeo?.status === "resolved" ? log.ipGeo : null;
  const unknown = t("admin.logs.geo.unknown");
  return (
    <td className="py-3 px-4">
      <div className="flex items-center gap-2">
        {log.ipSource && (
          <button
            type="button"
            onClick={() => onShowGeo(log)}
            className="cursor-pointer rounded-sm hover:scale-110 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            title={geo ? geo.countryName || "" : unknown}
            aria-label={geo ? geo.countryName || t("admin.logs.geo.modal_title") : unknown}
          >
            <span className="text-lg">
              {geo ? countryCodeToFlagEmoji(geo.countryCode) : "\u2753"}
            </span>
          </button>
        )}
        <span className="text-sm text-[var(--foreground-muted)] font-mono">
          {log.ipSource || "-"}
        </span>
      </div>
    </td>
  );
}

function DatesCells({ log }: Readonly<{ log: LogEntry }>) {
  const { t } = useTranslation();
  return (
    <>
      <td className="py-3 px-4">
        <span className="text-sm text-[var(--foreground)]">{formatDate(log.createdAt)}</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-[var(--foreground-muted)]">
          {log.expiresAt ? formatDate(log.expiresAt) : t("admin.logs.never")}
        </span>
      </td>
    </>
  );
}

function StatusCell({ log }: Readonly<{ log: LogEntry }>) {
  const { t } = useTranslation();
  return (
    <td className="py-3 px-4">
      <div className="flex items-center gap-2 flex-wrap">
        {isExpired(log.expiresAt) || isViewLimitReached(log.maxViews, log.viewCount) ? (
          <Badge variant="danger">{t("admin.logs.expired")}</Badge>
        ) : (
          <Badge variant="success">{t("admin.logs.active")}</Badge>
        )}
        {log.maxViews && (
          <span
            title={t("admin.logs.views_title", {
              count: log.viewCount,
              max: log.maxViews,
            })}
          >
            <Badge variant="info">
              👁️ {log.viewCount}/{log.maxViews}
            </Badge>
          </span>
        )}
        {log.hasPassword && (
          <span
            role="img"
            title={t("admin.logs.password_protected")}
            aria-label={t("admin.logs.password_protected")}
          >
            <svg
              className="w-4 h-4 text-[var(--warning-text)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </span>
        )}
      </div>
    </td>
  );
}

function ActionsCell({
  log,
  deleting,
  onDelete,
}: Readonly<{ log: LogEntry; deleting: boolean; onDelete: (log: LogEntry) => void }>) {
  const { t } = useTranslation();
  return (
    <td className="py-3 px-4 text-right">
      <Button
        type="button"
        size="sm"
        variant="danger-outline"
        onClick={() => onDelete(log)}
        isLoading={deleting}
        className="gap-2"
      >
        {deleting ? (
          t("admin.logs.deleting")
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v2M4 7h16"
              />
            </svg>
            {t("admin.logs.delete")}
          </>
        )}
      </Button>
    </td>
  );
}

export default function LogRow({
  log,
  deleting,
  onShowGeo,
  onDelete,
}: Readonly<{
  log: LogEntry;
  deleting: boolean;
  onShowGeo: (log: LogEntry) => void;
  onDelete: (log: LogEntry) => void;
}>) {
  return (
    <tr className="hover:bg-[var(--surface-hover)] transition-colors duration-100">
      <TypeCell log={log} />
      <SlugCell log={log} />
      <OwnerCell log={log} />
      <GeoCell log={log} onShowGeo={onShowGeo} />
      <DatesCells log={log} />
      <StatusCell log={log} />
      <ActionsCell log={log} deleting={deleting} onDelete={onDelete} />
    </tr>
  );
}
