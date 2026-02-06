import { decrypt } from "@/lib/crypto-link";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";


function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
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

    if (share.type !== "URL") {
        return jsonResponse({ error: "Erreur dans le partage" }, 400);
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
    if (!share.urlOriginal) return jsonResponse({ error: "URL introuvable" }, 500);
    return Response.redirect(share.urlOriginal, 302);
}

export async function POST(request: Request) {
    // Gestion des DATAS
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
        // Si pas protégé, return data directly
       return jsonResponse({ url: share.urlOriginal });
    }

    // check password
    const ok = await bcrypt.compare(password, share.password);
    if (!ok) return jsonResponse({ error: "Mot de passe incorrect" }, 401);


        const decrypted = decrypt(share.urlOriginal || "", password);
        return jsonResponse({ url: decrypted });
 
}
