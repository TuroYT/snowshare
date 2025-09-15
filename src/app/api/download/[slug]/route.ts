import { NextRequest, NextResponse } from "next/server";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  
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
    
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(fullPath);
    
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
    
    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${originalFilename}"`);
    headers.set('Content-Length', fileBuffer.length.toString());
    
    // For images, PDFs, and text files, allow inline viewing
    if (contentType.startsWith('image/') || contentType === 'application/pdf' || contentType.startsWith('text/')) {
      const disposition = request.headers.get('accept')?.includes('text/html') ? 'inline' : 'attachment';
      headers.set('Content-Disposition', `${disposition}; filename="${originalFilename}"`);
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
    
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Erreur lors du téléchargement" }, { status: 500 });
  }
}