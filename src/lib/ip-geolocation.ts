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
  if (!ip || ip === "127.0.0.1" || ip === "::1") {
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
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return;
    }
    throw err;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`http://api.db-ip.com/v2/free/${ip}`, {
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
      .catch(() => {});
  }
}

export function countryCodeToFlagEmoji(
  countryCode: string | null | undefined
): string {
  if (!countryCode || countryCode.length !== 2) {
    return "\u2753";
  }

  const code = countryCode.toUpperCase();
  const offset = 0x1f1e6 - 65;
  return String.fromCodePoint(
    code.charCodeAt(0) + offset,
    code.charCodeAt(1) + offset
  );
}
