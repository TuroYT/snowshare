import { NextRequest, NextResponse } from "next/server";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { createReadStream, statSync, existsSync } from "fs";
import path from "path";
import { nodeStreamToWebStream, parseRangeHeader } from "@/lib/stream-utils";

// Helper function to sanitize filename for Content-Disposition header
function sanitizeFilename(filename: string): string {
  // Remove or replace characters that could cause header injection
  const sanitized = filename
    .replace(/[\r\n]/g, '') // Remove newlines
    .replace(/["\\/]/g, '_') // Replace quotes and slashes
    .replace(/[^\x20-\x7E]/g, '_'); // Replace non-ASCII printable characters
  return sanitized;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
  if (!slug) {
    return NextResponse.json({ error: "Slug manquant" }, { status: 400 });
  }

  try {
    // Get password from query params if provided
    const url = new URL(request.url);
    const password = url.searchParams.get("password") || undefined;

    const result = await getFileShare(slug, password);
    
    if (result.error) {
      const status = result.requiresPassword ? 403 : 404;
      return NextResponse.json({ error: result.error }, { status });
    }

    const { filePath: fullPath, originalFilename } = result;
    
    if (!fullPath || !existsSync(fullPath)) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    // Get file stats for size
    const stats = statSync(fullPath);
    const fileSize = stats.size;
    
    // Determine content type
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Sanitize filename for Content-Disposition header to prevent header injection
    const safeFilename = sanitizeFilename(originalFilename || 'download');
    
    // Handle range request for resumable downloads
    const range = request.headers.get("range");
    
    if (range) {
      const rangeResult = parseRangeHeader(range, fileSize);
      
      if (!rangeResult) {
        return new Response(null, { 
          status: 416, 
          headers: { "Content-Range": `bytes */${fileSize}` } 
        });
      }

      const { start, end } = rangeResult;
      const chunksize = (end - start) + 1;
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
    
    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Length', fileSize.toString());
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    
    // For images, PDFs, and text files, allow inline viewing
    if (contentType.startsWith('image/') || contentType === 'application/pdf' || contentType.startsWith('text/')) {
      const disposition = request.headers.get('accept')?.includes('text/html') ? 'inline' : 'attachment';
      headers.set('Content-Disposition', `${disposition}; filename="${safeFilename}"`);
    }

    return new NextResponse(webStream as ReadableStream<Uint8Array>, {
      status: 200,
      headers,
    });
    
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Erreur lors du téléchargement" }, { status: 500 });
  }
}