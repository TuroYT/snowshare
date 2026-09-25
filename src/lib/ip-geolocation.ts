import { isIP } from "net";
import { prisma } from "@/lib/prisma";

interface DbIpResponse {
  ipAddress: string;
  continentCode: string;
  continentName: string;
  countryCode: string;
  countryName: string;
  stateProv: string;
  city: string;
}

/**
 * Fire-and-forget geolocation lookup for an IP address.
 * Does not block the caller — the promise is not awaited.
 */
export function lookupIpGeolocation(ip: string): void {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || !isIP(ip)) {
    return;
  }

  _performLookup(ip).catch((err) => {
    console.error(`[IP Geolocation] Unexpected error for ${ip}:`, err);
  });
}

async function _performLookup(ip: string): Promise<void> {
  const existing = await prisma.ipLocalisation.findUnique({
    where: { ip },
  });

  if (existing) {
    return;
  }

  try {
    await prisma.ipLocalisation.create({
      data: { ip, status: "pending" },
    });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return;
    }
    throw err;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://api.db-ip.com/v2/free/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`db-ip API returned ${response.status}`);
    }

    const data: DbIpResponse = await response.json();

    await prisma.ipLocalisation.update({
      where: { ip },
      data: {
        continentCode: data.continentCode || null,
        continentName: data.continentName || null,
        countryCode: data.countryCode || null,
        countryName: data.countryName || null,
        stateProv: data.stateProv || null,
        city: data.city || null,
        status: "resolved",
      },
    });
  } catch (err) {
    console.warn(`[IP Geolocation] Lookup failed for ${ip}:`, err);

    await prisma.ipLocalisation
      .update({
        where: { ip },
        data: { status: "unknown" },
      })
      .catch((updateErr) => {
        console.error(`[IP Geolocation] Failed to mark ${ip} as unknown:`, updateErr);
      });
  }
}

export function countryCodeToFlagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) {
    return "\u2753";
  }

  const code = countryCode.toUpperCase();
  const offset = 0x1f1e6 - 65;
  return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
}
