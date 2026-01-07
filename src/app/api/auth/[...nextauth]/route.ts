import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { getAuthOptions } from "@/lib/auth";

// Next.js 15+ types expect params as a Promise in Route Handlers.
// We await it and forward the resolved params object to NextAuth.
const handler = async (
  req: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) => {
  const [authOptions, params] = await Promise.all([
    getAuthOptions(),
    context.params,
  ]);

  return NextAuth(authOptions)(req, { params });
};

export { handler as GET, handler as POST };