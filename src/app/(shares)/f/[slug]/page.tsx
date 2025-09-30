"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface FileInfo {
    filename: string;
    fileSize?: number;
    requiresPassword: boolean;
}

export default function FileSharePage() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const [loadingInfo, setLoadingInfo] = useState(true);
    const params = useParams();
    const slug = params.slug as string;

    // Fetch file info on load
    useEffect(() => {
        const fetchFileInfo = async () => {
            try {
                const response = await fetch(`/f/${slug}/api`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "info" })
                });

                const data = await response.json();

                if (response.ok) {
                    setFileInfo(data);
                } else {
                    setError(data.error || "Erreur lors du chargement des informations");
                }
            } catch {
                setError("Erreur de connexion");
            } finally {
                setLoadingInfo(false);
            }
        };

        fetchFileInfo();
    }, [slug]);

    const handleDownload = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (fileInfo?.requiresPassword && !password) {
            setError("Mot de passe requis");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch(`/f/${slug}/api`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "download",
                    password: password || undefined
                })
            });

            if (response.ok) {
                // Get the download URL from the response
                const data = await response.json();
                if (data.downloadUrl) {
                    // Open download link in new window
                    window.open(data.downloadUrl, "_blank");
                }
            } else {
                const data = await response.json();
                setError(data.error || "Erreur lors du téléchargement");
            }
        } catch {
            setError("Erreur de connexion");
        } finally {
            setLoading(false);
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return "Taille inconnue";
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
    };

    if (loadingInfo) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                    <p className="text-gray-400">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!fileInfo && error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8 text-center">
                    <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-900/20 border border-red-800">
                        <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-100">Fichier introuvable</h2>
                    <p className="text-gray-400">{error}</p>
                    <Link
                        href="/"
                        className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Retour à l&apos;accueil
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-purple-900/20 border border-purple-800">
                        <svg className="h-8 w-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-100">Télécharger le fichier</h2>
                    <div className="mt-4 bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <p className="text-lg font-medium text-gray-200 truncate" title={fileInfo?.filename}>
                            {fileInfo?.filename}
                        </p>
                        {fileInfo?.fileSize && (
                            <p className="text-sm text-gray-400 mt-1">Taille: {formatFileSize(fileInfo.fileSize)}</p>
                        )}
                    </div>
                    {fileInfo?.requiresPassword && (
                        <p className="mt-2 text-center text-sm text-gray-400">
                            Ce fichier est protégé par un mot de passe
                        </p>
                    )}
                </div>

                {fileInfo?.requiresPassword ? (
                    <form className="mt-8 space-y-6" onSubmit={handleDownload}>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                                Mot de passe
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="appearance-none relative block w-full px-3 py-3 border border-gray-600 placeholder-gray-400 text-gray-100 bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm transition-colors"
                                placeholder="Entrez le mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-800 rounded-md p-3">
                                <div className="flex items-center justify-center">
                                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    {error}
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? (
                                <div className="flex items-center">
                                    <svg
                                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Téléchargement...
                                </div>
                            ) : (
                                <>
                                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 10v6m0 0l-3-3m3 3l3-3M4 7h16"
                                        />
                                    </svg>
                                    Télécharger
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <div className="mt-8 space-y-6">
                        {error && (
                            <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-800 rounded-md p-3">
                                <div className="flex items-center justify-center">
                                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    {error}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => handleDownload()}
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? (
                                <div className="flex items-center">
                                    <svg
                                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Téléchargement...
                                </div>
                            ) : (
                                <>
                                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 10v6m0 0l-3-3m3 3l3-3M4 7h16"
                                        />
                                    </svg>
                                    Télécharger
                                </>
                            )}
                        </button>
                    </div>
                )}

                <div className="mt-6 text-center text-xs text-gray-500">
                    <p>En téléchargeant ce fichier, vous acceptez qu&apos;il provient d&apos;une source tierce.</p>
                </div>
            </div>
        </div>
    );
}
