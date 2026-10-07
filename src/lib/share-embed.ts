import type { Metadata, Viewport } from "next";
import { prisma } from "@/lib/prisma";
import { getSettingsCached } from "@/lib/settings";
import { formatBytes } from "@/lib/formatSize";
import { translate, type SupportedLocale } from "@/lib/i18n-server";
import { isShareExhausted, isShareExpired } from "@/lib/share-access";

/**
 * Open Graph / Twitter Card metadata for share pages, read by link preview bots
 * (Discord, WhatsApp, Slack...). Built without consuming a view: it only exposes what the
 * share page already shows before a view is counted (file name, size, note). Paste content
 * is gated by a view, so an excerpt is only shown for public pastes without a view limit,
 * and only when the admin enabled it.
 */

export type EmbedShareKind = "FILE" | "PASTE";

const EXCERPT_MAX_LENGTH = 200;
const NOTE_MAX_LENGTH = 200;

const PASTE_LANGUAGE_LABELS: Record<string, string> = {
  JAVASCRIPT: "JavaScript",
  TYPESCRIPT: "TypeScript",
  PYTHON: "Python",
  JAVA: "Java",
  PHP: "PHP",
  GO: "Go",
  POWERSHELL: "PowerShell",
  HTML: "HTML",
  CSS: "CSS",
  SQL: "SQL",
  JSON: "JSON",
  MARKDOWN: "Markdown",
};

export interface EmbedShare {
  type: string;
  password: string | null;
  expiresAt: Date | null;
  maxViews: number | null;
  viewCount: number;
  filePath: string | null;
  size: bigint | null;
  note: string | null;
  isBulk: boolean;
  paste: string | null;
  pastelanguage: string | null;
  files: { size: bigint }[];
}

export interface EmbedSettings {
  appName: string;
  embedPasteExcerpt: boolean;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface EmbedContent {
  title: string;
  description: string;
}

/** Collapses whitespace and cuts the text to `max` characters. */
export function truncateForEmbed(text: string, max: number): string {
  const flat = text.replaceAll(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

function fileContent(share: EmbedShare, t: Translate): EmbedContent {
  let title: string;
  let bytes: number | null;
  if (share.isBulk) {
    title = t("api.file_count", { count: share.files.length });
    bytes = share.files.reduce((sum, file) => sum + Number(file.size), 0);
  } else {
    // Stored as "<shareId>_<originalName>"
    title = share.filePath?.split("_").slice(1).join("_") || t("embed.file");
    bytes = share.size === null ? null : Number(share.size);
  }

  const lines = [
    bytes === null ? null : formatBytes(bytes),
    share.note && truncateForEmbed(share.note, NOTE_MAX_LENGTH),
  ];
  return { title, description: lines.filter(Boolean).join("\n") };
}

function pasteContent(share: EmbedShare, settings: EmbedSettings, t: Translate): EmbedContent {
  const language =
    PASTE_LANGUAGE_LABELS[share.pastelanguage ?? "PLAINTEXT"] ?? t("embed.plain_text");
  // Reading the content counts a view: never leak it for view-limited pastes
  const showExcerpt = settings.embedPasteExcerpt && share.maxViews === null && !!share.paste;
  return {
    title: t("embed.paste_title", { language }),
    description: showExcerpt ? truncateForEmbed(share.paste!, EXCERPT_MAX_LENGTH) : "",
  };
}

/** Builds the embed metadata of a share (pure: no database access). */
export function buildShareEmbed(
  share: EmbedShare | null,
  kind: EmbedShareKind,
  settings: EmbedSettings,
  locale: SupportedLocale
): Metadata {
  const t: Translate = (key, params) => translate(locale, key, params);
  const sharedVia = t("embed.shared_via", { appName: settings.appName });

  let content: EmbedContent;
  if (!share || share.type !== kind || isShareExpired(share) || isShareExhausted(share)) {
    content = { title: t("embed.unavailable"), description: "" };
  } else if (share.password) {
    content = {
      title: t(kind === "FILE" ? "embed.protected_file" : "embed.protected_paste"),
      description: "",
    };
  } else if (kind === "FILE") {
    content = fileContent(share, t);
  } else {
    content = pasteContent(share, settings, t);
  }

  const description = [content.description, sharedVia].filter(Boolean).join("\n");
  return {
    title: content.title,
    description,
    // Share pages are private by nature
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: settings.appName,
      title: content.title,
      description,
    },
    twitter: { card: "summary", title: content.title, description },
  };
}

const EMBED_SHARE_SELECT = {
  type: true,
  password: true,
  expiresAt: true,
  maxViews: true,
  viewCount: true,
  filePath: true,
  size: true,
  note: true,
  isBulk: true,
  paste: true,
  pastelanguage: true,
  files: { select: { size: true } },
} as const;

/**
 * Metadata for a share page. Returns an empty object (root layout defaults) when embeds are
 * disabled or the database is unavailable (static builds).
 */
export async function getShareEmbedMetadata(
  slug: string,
  kind: EmbedShareKind,
  locale: SupportedLocale
): Promise<Metadata> {
  if (!process.env.DATABASE_URL) return {};
  try {
    const settings = await getSettingsCached();
    if (settings && !settings.socialEmbedsEnabled) return {};

    const share = await prisma.share.findUnique({ where: { slug }, select: EMBED_SHARE_SELECT });
    return buildShareEmbed(
      share,
      kind,
      {
        appName: settings?.appName ?? "SnowShare",
        embedPasteExcerpt: settings?.embedPasteExcerpt ?? false,
      },
      locale
    );
  } catch (error) {
    console.error("Error building share embed metadata:", error);
    return {};
  }
}

/** Embed accent color (Discord's side bar), taken from the branding primary color. */
export async function getShareEmbedViewport(): Promise<Viewport> {
  if (!process.env.DATABASE_URL) return {};
  try {
    const settings = await getSettingsCached();
    if (!settings?.socialEmbedsEnabled) return {};
    return { themeColor: settings.primaryColor };
  } catch (error) {
    console.error("Error building share embed viewport:", error);
    return {};
  }
}
