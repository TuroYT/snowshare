import crypto from "crypto";

interface TokenEntry {
  shareId: string;
  expiresAt: number;
}

const store = new Map<string, TokenEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 5 * 60_000).unref?.();

export function issueDownloadToken(shareId: string, ttlMs = 2 * 60_000): string {
  const token = crypto.randomBytes(32).toString("hex");
  store.set(token, { shareId, expiresAt: Date.now() + ttlMs });
  return token;
}

export function validateDownloadToken(token: string, shareId: string): boolean {
  const entry = store.get(token);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return false;
  }
  return entry.shareId === shareId;
}
