import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/getClientIp";
import { detectLocale, translate } from "@/lib/i18n-server";

const handler = async (req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) => {
  const [authOptions, params] = await Promise.all([getAuthOptions(), context.params]);

  // Rate-limit credentials sign-in attempts
  if (req.method === "POST") {
    const segments: string[] = params.nextauth ?? [];
    const isCredentialsCallback =
      segments.join("/") === "callback/credentials" || segments.join("/") === "signin/credentials";

    if (isCredentialsCallback) {
      const ip = getClientIp(req);
      if (!checkRateLimit(`signin:${ip}`, 10, 15 * 60_000)) {
        const locale = detectLocale(req);
        const message = translate(locale, "api.errors.rate_limit_exceeded");
        return NextResponse.json({ error: message }, { status: 429 });
      }
    }
  }

  return NextAuth(authOptions)(req, { params });
};

export { handler as GET, handler as POST };
