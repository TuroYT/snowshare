import { NextRequest, NextResponse } from "next/server";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Helper function to sanitize filename for Content-Disposition header
function sanitizeFilename(filename: string): string {
  // Remove or replace characters that could cause header injection
  const sanitized = filename
    .replace(/[\r\n]/g, '') // Remove newlines
    .replace(/["\\/]/g, '_') // Replace quotes and slashes
    .replace(/[^\x20-\x7E]/g, '_'); // Replace non-ASCII printable characters
  return sanitized;
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

// Handle POST requests for file info and download actions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
  if (!slug) {
    return jsonResponse({ error: "Slug manquant" }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Corps JSON attendu" }, 400);
  }

  const { action, password } = body;

  if (!action) {
    return jsonResponse({ error: "Action manquante" }, 400);
  }

  try {
    if (action === "info") {
      // Get file info without password first to check if password is required
      const result = await getFileShare(slug);
      
      if (result.error && !result.requiresPassword) {
        return jsonResponse({ error: result.error }, 404);
      }

      if (result.requiresPassword) {
        return jsonResponse({
          filename: "Fichier protégé",
          requiresPassword: true
        });
      }

      // Get file stats
      const { filePath: fullPath, originalFilename } = result;
      if (!fullPath || !existsSync(fullPath)) {
        return jsonResponse({ error: "Fichier introuvable" }, 404);
      }

      const stats = await stat(fullPath);
      
      return jsonResponse({
        filename: originalFilename,
        fileSize: stats.size,
        requiresPassword: false
      });
    }

    if (action === "download") {
      const result = await getFileShare(slug, password);
      
      if (result.error) {
        const status = result.requiresPassword ? 403 : 404;
        return jsonResponse({ error: result.error }, status);
      }

      const { filePath: fullPath } = result;
      
      if (!fullPath || !existsSync(fullPath)) {
        return jsonResponse({ error: "Fichier introuvable" }, 404);
      }

      // Generate a download URL with password if needed
      const downloadUrl = `/f/${slug}/download${password ? `?password=${encodeURIComponent(password)}` : ''}`;
      
      return jsonResponse({ downloadUrl });
    }

    return jsonResponse({ error: "Action non supportée" }, 400);
    
  } catch (error) {
    console.error("File share error:", error);
    return jsonResponse({ error: "Erreur lors du traitement" }, 500);
  }
}

// Keep GET for backward compatibility and direct downloads
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
  if (!slug) {
    return jsonResponse({ error: "Slug manquant" }, 400);
  }

  try {
    // Get password from query params if provided
    const url = new URL(request.url);
    const password = url.searchParams.get("password") || undefined;

    const result = await getFileShare(slug, password);
    
    if (result.error) {
      // If password required, redirect to the page for password input
      if (result.requiresPassword && !password) {
        const pageUrl = new URL(`/f/${slug}`, url.origin);
        return Response.redirect(pageUrl.toString(), 302);
      }
      
      const status = result.requiresPassword ? 403 : 404;
      return jsonResponse({ error: result.error }, status);
    }

    const { filePath: fullPath, originalFilename } = result;
    
    if (!fullPath || !existsSync(fullPath)) {
      return jsonResponse({ error: "Fichier introuvable" }, 404);
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
    
    // Sanitize filename for Content-Disposition header to prevent header injection
    const safeFilename = sanitizeFilename(originalFilename || 'download');
    
    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
    headers.set('Content-Length', fileBuffer.length.toString());
    
    // For images, PDFs, and text files, allow inline viewing
    if (contentType.startsWith('image/') || contentType === 'application/pdf' || contentType.startsWith('text/')) {
      const disposition = request.headers.get('accept')?.includes('text/html') ? 'inline' : 'attachment';
      headers.set('Content-Disposition', `${disposition}; filename="${safeFilename}"`);
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers,
    });
    
  } catch (error) {
    console.error("Download error:", error);
    return jsonResponse({ error: "Erreur lors du téléchargement" }, 500);
  }
}