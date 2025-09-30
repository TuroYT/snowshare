import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}

export async function OPTIONS() {
    return new Response(null, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = await params;

        if (!slug) {
            return jsonResponse({ error: "Slug manquant" }, 400);
        }

        const share = await prisma.share.findUnique({ 
            where: { slug },
            select: {
                id: true,
                type: true,
                paste: true,
                pastelanguage: true,
                password: true,
                createdAt: true,
                expiresAt: true,
                slug: true,
                ownerId: true,
            }
        });

        if (!share) {
            return jsonResponse({ error: "Paste introuvable" }, 404);
        }

        // Vérifier si le partage a expiré
        if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
            return jsonResponse({ error: "Ce paste a expiré" }, 410);
        }

        // Vérifier si c'est bien un paste
        if (share.type !== "PASTE") {
            return jsonResponse({ error: "Ce lien ne correspond pas à un paste" }, 400);
        }

        // Si le paste est protégé par mot de passe
        if (share.password) {
            return jsonResponse({ 
                error: "Ce paste est protégé par mot de passe",
                requiresPassword: true,
                slug: share.slug,
                createdAt: share.createdAt,
                expiresAt: share.expiresAt,
            }, 403);
        }

        // Retourner le paste public
        return jsonResponse({
            success: true,
            data: {
                paste: share.paste,
                language: share.pastelanguage,
                slug: share.slug,
                createdAt: share.createdAt,
                expiresAt: share.expiresAt,
                ownerId: share.ownerId,
            }
        });

    } catch (error) {
        console.error("Erreur lors de la récupération du paste:", error);
        return jsonResponse({ error: "Erreur serveur interne" }, 500);
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = await params;

        if (!slug) {
            return jsonResponse({ error: "Slug manquant" }, 400);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: "Corps JSON invalide" }, 400);
        }

        const { password } = body;

        if (!password || typeof password !== "string") {
            return jsonResponse({ error: "Mot de passe manquant ou invalide" }, 400);
        }

        const share = await prisma.share.findUnique({ 
            where: { slug },
            select: {
                id: true,
                type: true,
                paste: true,
                pastelanguage: true,
                password: true,
                createdAt: true,
                expiresAt: true,
                slug: true,
                ownerId: true,
            }
        });

        if (!share) {
            return jsonResponse({ error: "Paste introuvable" }, 404);
        }

        // Vérifier si le partage a expiré
        if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
            return jsonResponse({ error: "Ce paste a expiré" }, 410);
        }

        // Vérifier si c'est bien un paste
        if (share.type !== "PASTE") {
            return jsonResponse({ error: "Ce lien ne correspond pas à un paste" }, 400);
        }

        // Vérifier si le paste nécessite un mot de passe
        if (!share.password) {
            return jsonResponse({ error: "Ce paste ne nécessite pas de mot de passe" }, 400);
        }

        // Vérifier le mot de passe
        const isPasswordValid = await bcrypt.compare(password, share.password);

        if (!isPasswordValid) {
            return jsonResponse({ error: "Mot de passe incorrect" }, 401);
        }

        // Retourner le paste déprotégé
        return jsonResponse({
            success: true,
            data: {
                paste: share.paste,
                language: share.pastelanguage,
                slug: share.slug,
                createdAt: share.createdAt,
                expiresAt: share.expiresAt,
                ownerId: share.ownerId,
            }
        });

    } catch (error) {
        console.error("Erreur lors de la vérification du mot de passe:", error);
        return jsonResponse({ error: "Erreur serveur interne" }, 500);
    }
}
