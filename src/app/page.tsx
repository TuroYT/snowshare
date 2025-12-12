"use client";

import Navigation from "@/components/Navigation";
import { useState } from "react";
import LinkShare from "@/components/LinkShare";
import PasteShare from "@/components/PasteShare";
import FileShare from "@/components/FileShare";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";
import { useBranding } from "@/components/BrandingProvider";
import { useTheme } from "@/hooks/useTheme";

export default function Home() {
    const [activeTab, setActiveTab] = useState("linkshare");
    const { t } = useTranslation();
    const { branding } = useBranding();
    const { colors } = useTheme();

    const tabs = [
        { id: "linkshare", label: t("tabs.linkshare", "LinkShare"), component: <LinkShare /> },
        { id: "pasteshare", label: t("tabs.pasteshare", "PasteShare"), component: <PasteShare /> },
        { id: "fileshare", label: t("tabs.fileshare", "FileShare"), component: <FileShare /> }
    ];

    return (
        <div className="min-h-screen bg-[var(--background)]">
            <Navigation />

            <main className="max-w-6xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    {/* Hero Section */}
                    <div className="mb-12">
                        <h1 
                            className="text-5xl font-extrabold sm:text-6xl md:text-7xl bg-clip-text text-transparent"
                            style={{ backgroundImage: `linear-gradient(to right, ${colors.primaryColor}, ${colors.secondaryColor}, ${colors.primaryColor})` }}
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
                                        backgroundImage: `linear-gradient(to right, ${colors.primaryColor}, ${colors.secondaryColor})`,
                                        boxShadow: `0 10px 15px -3px ${colors.primaryColor}40`
                                    } : undefined}
                                >
                                    <span className="relative z-10">{tab.label}</span>
                                    {activeTab === tab.id && (
                                        <div 
                                            className="absolute inset-0 rounded-xl blur-xl opacity-20"
                                            style={{ backgroundImage: `linear-gradient(to right, ${colors.primaryColor}, ${colors.secondaryColor})` }}
                                        ></div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                    
                            <div className="flex justify-center">
                                {tabs.find((tab) => tab.id === activeTab)?.component}
                            </div>
                      
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
