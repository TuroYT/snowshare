/**
 * GET /api/v1/openapi.json — Serve the OpenAPI 3.1 spec
 */

import { NextRequest, NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const spec = buildOpenApiSpec(baseUrl);
  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
