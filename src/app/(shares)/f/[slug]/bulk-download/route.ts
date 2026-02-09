import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createZipStream } from "@/lib/bulk-upload-utils";
import { nodeStreamToWebStream } from "@/lib/stream-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return jsonResponse({ error: "Slug required" }, 400);
  }

  try {
    const url = new URL(request.url);
    const password = url.searchParams.get("password") || undefined;

    const share = await prisma.share.findUnique({
      where: { slug },
      include: {
        files: true,
      },
    });

    if (!share || share.type !== "FILE") {
      return jsonResponse({ error: "Share not found" }, 404);
    }

    if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
      return jsonResponse({ error: "This share has expired" }, 410);
    }

    if (share.password) {
      if (!password) {
        return jsonResponse(
          { error: "Password required", requiresPassword: true },
          403
        );
      }

      const passwordValid = await bcrypt.compare(password, share.password);
      if (!passwordValid) {
        return jsonResponse({ error: "Incorrect password" }, 403);
      }
    }

    if (!share.isBulk || !share.files || share.files.length === 0) {
      return jsonResponse({ error: "No files found for bulk download" }, 404);
    }

    const filesForZip = share.files.map((file) => ({
      filePath: file.filePath,
      originalName: file.originalName,
      relativePath: file.relativePath || file.originalName,
    }));

    const zipStream = await createZipStream(filesForZip);
    const webStream = nodeStreamToWebStream(zipStream);

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${slug}_files.zip"`
    );
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    return new NextResponse(webStream as ReadableStream<Uint8Array>, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Bulk download error:", error);
    return jsonResponse({ error: "Error during download" }, 500);
  }
}
