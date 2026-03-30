import { NextRequest, NextResponse } from "next/server";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { existsSync } from "fs";
import { stat } from "fs/promises";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { getMimeType, isSafeForInline, sanitizeFilenameForHeader } from "@/lib/mime-types";
import { detectLocale, translate } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";

// Handle POST requests for file info and download actions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError(request, ErrorCode.INVALID_JSON);
  }

  const { action, password } = body;

  if (!action) {
    return apiError(request, ErrorCode.INVALID_REQUEST);
  }

  try {
    if (action === "info") {
      // Get file info without password first to check if password is required
      const result = await getFileShare(slug);

      if (result.errorCode && !result.requiresPassword) {
        return apiError(request, result.errorCode);
      }

      if (result.requiresPassword) {
        const locale = detectLocale(request);
        return NextResponse.json({
          filename: translate(locale, "api.file_protected"),
          requiresPassword: true,
          isBulk: result.isBulk || false,
        });
      }

      if (result.isBulk && result.share) {
        const files = result.share.files || [];
        const totalSize = files.reduce(
          (sum: number, file: { size: bigint }) => sum + Number(file.size),
          0
        );
        const fileList = files.map((file) => ({
          name: file.originalName,
          path: file.relativePath || file.originalName,
          size: Number(file.size),
        }));

        return NextResponse.json({
          filename: `${files.length} files`,
          fileSize: totalSize,
          requiresPassword: false,
          isBulk: true,
          fileCount: files.length,
          files: fileList,
        });
      }

      const { filePath: fullPath, originalFilename } = result;
      if (!fullPath || !existsSync(fullPath)) {
        return apiError(request, ErrorCode.FILE_NOT_FOUND);
      }

      const stats = await stat(fullPath);

      return NextResponse.json({
        filename: originalFilename,
        fileSize: stats.size,
        requiresPassword: false,
        isBulk: false,
      });
    }

    if (action === "download") {
      const result = await getFileShare(slug, password);

      if (result.errorCode) {
        return apiError(request, result.errorCode);
      }

      // Increment view count
      if (result.share) {
        await prisma.share.update({
          where: { id: result.share.id },
          data: { viewCount: { increment: 1 } },
        });
      }

      if (result.isBulk) {
        const downloadUrl = `/f/${slug}/bulk-download${password ? `?password=${encodeURIComponent(password)}` : ""}`;
        return NextResponse.json({ downloadUrl, isBulk: true });
      }

      const { filePath: fullPath } = result;

      if (!fullPath || !existsSync(fullPath)) {
        return apiError(request, ErrorCode.FILE_NOT_FOUND);
      }

      const downloadUrl = `/f/${slug}/download${password ? `?password=${encodeURIComponent(password)}` : ""}`;

      return NextResponse.json({ downloadUrl, isBulk: false });
    }

    return apiError(request, ErrorCode.INVALID_REQUEST);
  } catch (error) {
    console.error("File share error:", error);
    return internalError(request);
  }
}

// Keep GET for backward compatibility and direct downloads
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  try {
    // Get password from query params if provided
    const url = new URL(request.url);
    const password = url.searchParams.get("password") || undefined;

    const result = await getFileShare(slug, password);

    if (result.errorCode) {
      // If password required, redirect to the page for password input
      if (result.requiresPassword && !password) {
        const pageUrl = new URL(`/f/${slug}`, url.origin);
        return Response.redirect(pageUrl.toString(), 302);
      }

      return apiError(request, result.errorCode);
    }

    const { filePath: fullPath, originalFilename } = result;

    if (!fullPath || !existsSync(fullPath)) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    // Get file stats for size
    const stats = await stat(fullPath);
    const fileSize = stats.size;

    // Determine content type
    const ext = (await import("path")).extname(fullPath).toLowerCase();
    const contentType = getMimeType(ext);

    // Sanitize filename for Content-Disposition header
    const safeFilename = sanitizeFilenameForHeader(originalFilename || "download");

    // Handle range request for resumable downloads
    const { createReadStream } = await import("fs");
    const { nodeStreamToWebStream, parseRangeHeader } = await import("@/lib/stream-utils");
    const range = request.headers.get("range");

    if (range) {
      const rangeResult = parseRangeHeader(range, fileSize);

      if (!rangeResult) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const { start, end } = rangeResult;
      const chunksize = end - start + 1;
      const fileStream = createReadStream(fullPath, { start, end });
      const webStream = nodeStreamToWebStream(fileStream);

      const headers = new Headers();
      headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Length", chunksize.toString());
      headers.set("Content-Type", contentType);
      headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");

      return new NextResponse(webStream as ReadableStream<Uint8Array>, {
        status: 206,
        headers,
      });
    }

    // Full file download using streaming
    const fileStream = createReadStream(fullPath);
    const webStream = nodeStreamToWebStream(fileStream);

    const headers = new Headers();
    headers.set("Content-Length", fileSize.toString());
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    // Allow inline viewing only for safe types (excludes SVG/HTML to prevent XSS)
    if (isSafeForInline(contentType)) {
      const disposition = request.headers.get("accept")?.includes("text/html")
        ? "inline"
        : "attachment";
      headers.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`);
    }

    return new NextResponse(webStream as ReadableStream<Uint8Array>, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Download error:", error);
    return internalError(request);
  }
}
