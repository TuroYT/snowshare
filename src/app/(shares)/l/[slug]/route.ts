import { decrypt } from "@/lib/crypto-link";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { apiError, ErrorCode } from "@/lib/api-errors";
import { NextRequest } from "next/server";


function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    // support /s?slug=... and /s/<slug>
    let slug = url.searchParams.get("slug");
    if (!slug) {
        const parts = url.pathname.split("/").filter(Boolean); // ["s", "<slug>"] or ["s"]
        if (parts.length >= 2) slug = parts[1];
    }

    if (!slug) return apiError(request, ErrorCode.MISSING_DATA);

    const share = await prisma.share.findUnique({ where: { slug } });
    if (!share) return apiError(request, ErrorCode.SHARE_NOT_FOUND);

    if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
        return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (share.maxViews !== null && share.viewCount >= share.maxViews) {
        return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (share.type !== "URL") {
        return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    //? Gestion PASSWORD
    if (share.password) {
        // Utiliser les headers du reverse proxy pour obtenir l'origine publique
        const protocol = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
        const publicOrigin = `${protocol}://${host}`;
        const viewUrl = new URL(`/l/${slug}/private`, publicOrigin);
        return Response.redirect(viewUrl.toString(), 302);
    }
    if (!share.urlOriginal) return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);

    // Increment view count
    await prisma.share.update({
        where: { id: share.id },
        data: { viewCount: { increment: 1 } },
    });

    return Response.redirect(share.urlOriginal, 302);
}

export async function POST(request: NextRequest) {
    // Gestion des DATAS
    let body;
    try {
        body = await request.json();
    } catch {
        return apiError(request, ErrorCode.INVALID_JSON);
    }

    const slug = body?.slug;
    const password = body?.password;
    if (!slug || typeof slug !== "string") return apiError(request, ErrorCode.MISSING_DATA);
    if (!password || typeof password !== "string") return apiError(request, ErrorCode.PASSWORD_REQUIRED);

    const share = await prisma.share.findUnique({ where: { slug } });
    if (!share) return apiError(request, ErrorCode.SHARE_NOT_FOUND);

    if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
        return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (share.maxViews !== null && share.viewCount >= share.maxViews) {
        return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (!share.password) {
        // Si pas protégé, return data directly
       return jsonResponse({ url: share.urlOriginal });
    }

    // check password
    const ok = await bcrypt.compare(password, share.password);
    if (!ok) return apiError(request, ErrorCode.PASSWORD_INCORRECT);

    // Increment view count
    await prisma.share.update({
        where: { id: share.id },
        data: { viewCount: { increment: 1 } },
    });

    const decrypted = decrypt(share.urlOriginal || "", password);
    return jsonResponse({ url: decrypted });
 
}
