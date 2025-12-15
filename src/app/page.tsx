"use client";

import Navigation from "@/components/Navigation";
import { useState, lazy, Suspense, useMemo } from "react";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";
import { useBranding } from "@/components/BrandingProvider";
import { useTheme } from "@/hooks/useTheme";

// Lazy load share components for better performance
const LinkShare = lazy(() => import("@/components/LinkShare"));
const PasteShare = lazy(() => import("@/components/PasteShare"));
const FileShare = lazy(() => import("@/components/FileShare"));

// Loading fallback component
function TabLoadingFallback() {
    return (
        <div className="bg-[var(--surface)]/30 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-[var(--border)]/50 w-full max-w-2xl mx-auto">
            <div className="animate-pulse space-y-4">
                <div className="h-4 bg-[var(--surface)] rounded w-3/4"></div>
                <div className="h-4 bg-[var(--surface)] rounded w-1/2"></div>
                <div className="h-32 bg-[var(--surface)] rounded"></div>
            </div>
        </div>
    );
}

export default function Home() {
    const [activeTab, setActiveTab] = useState("linkshare");
    const { t } = useTranslation();
    const { branding } = useBranding();
    const { colors } = useTheme();

    // Memoize tabs configuration
    const tabs = useMemo(() => [
        { id: "linkshare", label: t("tabs.linkshare", "LinkShare") },
        { id: "pasteshare", label: t("tabs.pasteshare", "PasteShare") },
        { id: "fileshare", label: t("tabs.fileshare", "FileShare") }
    ], [t]);

    // Memoize gradient styles
    const primaryGradient = useMemo(() => 
        `linear-gradient(to right, ${colors.primaryColor}, ${colors.secondaryColor}, ${colors.primaryColor})`,
        [colors.primaryColor, colors.secondaryColor]
    );

    const buttonGradient = useMemo(() => 
        `linear-gradient(to right, ${colors.primaryColor}, ${colors.secondaryColor})`,
        [colors.primaryColor, colors.secondaryColor]
    );

    const buttonShadow = useMemo(() => 
        `0 10px 15px -3px ${colors.primaryColor}40`,
        [colors.primaryColor]
    );

    return (
        <div className="min-h-screen bg-[var(--background)]">
            <Navigation />

            <main className="max-w-6xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    {/* Hero Section */}
                    <div className="mb-12">
                        <h1 
                            className="text-5xl font-extrabold sm:text-6xl md:text-7xl bg-clip-text text-transparent"
                            style={{ backgroundImage: primaryGradient }}
                        >
                            {branding.appName}
                        </h1>
                        <p className="mt-6 max-w-3xl mx-auto text-xl text-[var(--foreground)] leading-8">
                            {branding.appDescription}
                        </p>
                    </div>

                    {/* Tabs Section */}
                    <div className="mt-12">
                        <div className="flex flex-wrap justify-center gap-2 mb-8">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`group relative px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                                        activeTab === tab.id
                                            ? "text-white shadow-lg scale-105"
                                            : "bg-[var(--surface)]/50 text-[var(--foreground)] hover:bg-[var(--surface)]/70 hover:text-[var(--foreground)] hover:scale-105 border border-[var(--border)]/50"
                                    }`}
                                    style={activeTab === tab.id ? { 
                                        backgroundImage: buttonGradient,
                                        boxShadow: buttonShadow
                                    } : undefined}
                                >
                                    <span className="relative z-10">{tab.label}</span>
                                    {activeTab === tab.id && (
                                        <div 
                                            className="absolute inset-0 rounded-xl blur-xl opacity-20"
                                            style={{ backgroundImage: buttonGradient }}
                                        ></div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Content Area with Lazy Loading */}
                        <div className="flex justify-center">
                            <Suspense fallback={<TabLoadingFallback />}>
                                {activeTab === "linkshare" && <LinkShare />}
                                {activeTab === "pasteshare" && <PasteShare />}
                                {activeTab === "fileshare" && <FileShare />}
                            </Suspense>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
