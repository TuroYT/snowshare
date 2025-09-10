import { decrypt } from "@/lib/crypto-link";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    // support /s?slug=... and /s/<slug>
    let slug = url.searchParams.get("slug");
    if (!slug) {
        const parts = url.pathname.split("/").filter(Boolean); // ["s", "<slug>"] or ["s"]
        if (parts.length >= 2) slug = parts[1];
    }

    if (!slug) return jsonResponse({ error: "Slug manquant" }, 400);

    const share = await prisma.share.findUnique({ where: { slug } });
    if (!share) return jsonResponse({ error: "Partage introuvable" }, 404);

    if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
        return jsonResponse({ error: "Ce partage a expiré" }, 410);
    }

    // If this is a paste, prefer redirecting browser clients to the unified view page
    if (share.type === "PASTE") {
        const accept = request.headers.get("accept") || "";
        const url = new URL(request.url);
        // If the client expects HTML (browser), redirect to the view page which handles protected and public pastes
        if (accept.includes("text/html")) {
            const viewUrl = new URL(`/s/view/${slug}`, url.origin);
            return Response.redirect(viewUrl.toString(), 302);
        }

        // API clients: if paste is protected, return a protected error so frontend can POST the password
        if (share.password) {
            return jsonResponse({ error: "Ce partage est protégé" }, 403);
        }

        // Public paste for API clients -> return paste content
        return jsonResponse({
            paste: share.paste,
            pastelanguage: share.pastelanguage,
            ownerId: share.ownerId,
            createdAt: share.createdAt,
            expiresAt: share.expiresAt,
            slug: share.slug,
        });
    }

    // Gestion URL
    if (share.type === "URL") {
        // if protected, backend currently redirects — but if it returns JSON with message, handle it
        if (share.password) {
            const accept = request.headers.get("accept") || "";
            // If the client expects HTML (browser), redirect to the view page which handles protected and public pastes
            if (accept.includes("text/html")) {
                const viewUrl = new URL(`/protected?slug=${slug}`, url.origin);
                return Response.redirect(viewUrl.toString(), 302);
            }
            return jsonResponse({ error: "Ce partage est protégé" }, 403);
        }
        if (!share.urlOriginal) return jsonResponse({ error: "URL introuvable" }, 500);
        return Response.redirect(share.urlOriginal, 302);
    }

    // Gestion FILE (à compléter si besoin)
    return jsonResponse({ error: "Type de partage non géré" }, 400);
}

export async function POST(request: Request) {
    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: "Corps JSON attendu" }, 400);
    }

    const slug = body?.slug;
    const password = body?.password;
    if (!slug || typeof slug !== "string") return jsonResponse({ error: "Slug manquant" }, 400);
    if (!password || typeof password !== "string") return jsonResponse({ error: "Mot de passe manquant" }, 400);

    const share = await prisma.share.findUnique({ where: { slug } });
    if (!share) return jsonResponse({ error: "Partage introuvable" }, 404);

    if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
        return jsonResponse({ error: "Ce partage a expiré" }, 410);
    }

    if (!share.password) {
        // pas de mot de passe requis
        if (share.type === "PASTE") {
            return jsonResponse({
                paste: share.paste,
                pastelanguage: share.pastelanguage,
                ownerId: share.ownerId,
                createdAt: share.createdAt,
                expiresAt: share.expiresAt,
                slug: share.slug,
            });
        }
        if (share.type === "URL") {
            return jsonResponse({ url: share.urlOriginal });
        }
        return jsonResponse({ error: "Type de partage non géré" }, 400);
    }

    const ok = await bcrypt.compare(password, share.password);
    if (!ok) return jsonResponse({ error: "Mot de passe incorrect" }, 401);

    // Si paste protégé
    if (share.type === "PASTE") {
        return jsonResponse({
            paste: share.paste,
            pastelanguage: share.pastelanguage,
            ownerId: share.ownerId,
            createdAt: share.createdAt,
            expiresAt: share.expiresAt,
            slug: share.slug,
        });
    }
    // Si URL protégée
    if (share.type === "URL") {
        // decript url
        const decrypted = decrypt(share.urlOriginal || "", password);
        return jsonResponse({ url: decrypted });
    }
    return jsonResponse({ error: "Type de partage non géré" }, 400);
}