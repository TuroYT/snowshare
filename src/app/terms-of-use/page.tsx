"use client";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

export default function TermsOfUse() {
    const { colors } = useTheme();
    const [termsOfUseText, setTermsOfUseText] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        const fetchTermsOfUse = async () => {
            try {
                const response = await fetch('/api/terms-of-use');
                if (response.ok) {
                    const text = await response.text();
                    setTermsOfUseText(text);
                } else {
                    setError("Failed to load terms of use.");
                }
            } catch (err) {
                setError("An error occurred while loading the terms of use.");
            } finally {
                setLoading(false);
            }
        };

        fetchTermsOfUse();
    }, []); // Empty dependency array ensures this runs only once

    return (
        <div style={{ backgroundColor: colors.backgroundColor, color: colors.primaryColor }}>
            <Navigation />
            <main className="prose mx-auto p-4 min-h-screen">
                {loading ? (
                    <p>Loading terms of use...</p>
                ) : error ? (
                    <p className="text-red-500">{error}</p>
                ) : (
                    <ReactMarkdown>{termsOfUseText}</ReactMarkdown>
                )}
            </main>
            <Footer />
        </div>
    );
}
