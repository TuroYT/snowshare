"use client";

import { useSearchParams } from "next/navigation";
import { useState, FormEvent, Suspense } from "react";

function ProtectedContent() {
    const searchParams = useSearchParams();
    const slug = searchParams.get("slug");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!slug) {
            setError("Slug manquant dans l'URL.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/s/" + slug, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ slug, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Une erreur est survenue.");
            }

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error("URL non trouvée dans la réponse.");
            }
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Une erreur inconnue est survenue.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (!slug) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-red-500">
                    Slug manquant. Veuillez vérifier le lien.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
                    Contenu Protégé
                </h1>
                <p className="text-center text-gray-600 dark:text-gray-400">
                    Ce contenu est protégé par un mot de passe.
                </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label
                            htmlFor="password"
                            className="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Mot de passe
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-200 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-center text-red-500">{error}</p>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? "Vérification..." : "Accéder"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ProtectedPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
                <div className="text-gray-500">Chargement...</div>
            </div>
        }>
            <ProtectedContent />
        </Suspense>
    );
}
