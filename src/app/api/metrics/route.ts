import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function tokenMatches(header: string | null, expected: string): boolean {
  const given = Buffer.from(header?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(expected);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

/**
 * Prometheus metrics, disabled unless METRICS_TOKEN is set.
 * Scrape with `Authorization: Bearer <METRICS_TOKEN>`.
 */
export async function GET(request: NextRequest) {
  const token = process.env.METRICS_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });
  if (!tokenMatches(request.headers.get("authorization"), token)) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    const [users, byType, singleBytes, bulkBytes] = await Promise.all([
      prisma.user.count(),
      prisma.share.groupBy({ by: ["type"], _count: { _all: true } }),
      prisma.share.aggregate({ _sum: { size: true } }),
      prisma.shareFile.aggregate({ _sum: { size: true } }),
    ]);
    const bytes = (singleBytes._sum.size ?? BigInt(0)) + (bulkBytes._sum.size ?? BigInt(0));

    const lines = [
      "# HELP snowshare_users Registered users.",
      "# TYPE snowshare_users gauge",
      `snowshare_users ${users}`,
      "# HELP snowshare_shares Shares currently stored, by type.",
      "# TYPE snowshare_shares gauge",
      ...byType.map((r) => `snowshare_shares{type="${r.type}"} ${r._count._all}`),
      "# HELP snowshare_storage_bytes Bytes used by stored files.",
      "# TYPE snowshare_storage_bytes gauge",
      `snowshare_storage_bytes ${bytes}`,
    ];
    return new NextResponse(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Metrics collection failed:", error);
    return new NextResponse(null, { status: 503 });
  }
}
