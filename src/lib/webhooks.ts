import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSettingsCached } from "@/lib/settings";

export type ShareWebhookEvent = "share.created" | "share.accessed" | "share.deleted";

export interface WebhookShare {
  id: string;
  slug: string;
  type: "FILE" | "PASTE" | "URL";
  ownerId: string | null;
  expiresAt: Date | null;
}

const SHARE_PREFIX = { FILE: "f", PASTE: "p", URL: "l" } as const;
const TIMEOUT_MS = 5000;

export function isValidWebhookUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function signWebhookBody(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * POSTs a share event to the admin-configured webhook. Never throws: a slow or failing
 * receiver must not affect the request that triggered the event.
 */
export async function emitShareEvent(event: ShareWebhookEvent, shareOrId: WebhookShare | string) {
  try {
    const settings = await getSettingsCached();
    const url = settings?.webhookUrl;
    if (!url || !isValidWebhookUrl(url)) return;

    const share =
      typeof shareOrId === "string"
        ? await prisma.share.findUnique({
            where: { id: shareOrId },
            select: { id: true, slug: true, type: true, ownerId: true, expiresAt: true },
          })
        : shareOrId;
    if (!share) return;

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      share: {
        id: share.id,
        slug: share.slug,
        type: share.type,
        url: `${baseUrl}/${SHARE_PREFIX[share.type]}/${share.slug}`,
        ownerId: share.ownerId,
        expiresAt: share.expiresAt?.toISOString() ?? null,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SnowShare-Webhook",
      "X-SnowShare-Event": event,
    };
    if (settings.webhookSecret) {
      headers["X-SnowShare-Signature"] = signWebhookBody(settings.webhookSecret, body);
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) console.error(`Webhook ${event} answered ${res.status}`);
  } catch (error) {
    console.error(`Webhook ${event} failed:`, error);
  }
}
