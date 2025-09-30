"use client";

import Navigation from "@/components/Navigation";
import { useState } from "react";
import LinkShare from "@/components/LinkShare";
import PasteShare from "@/components/PasteShare";
import FileShare from "@/components/FileShare";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";

export default function Home() {
    const [activeTab, setActiveTab] = useState("linkshare");
    const { t } = useTranslation();

    const tabs = [
        { id: "linkshare", label: t("tabs.linkshare", "LinkShare"), component: <LinkShare /> },
        { id: "pasteshare", label: t("tabs.pasteshare", "PasteShare"), component: <PasteShare /> },
        { id: "fileshare", label: t("tabs.fileshare", "FileShare"), component: <FileShare /> }
    ];

    return (
        <div className="min-h-screen bg-gray-900">
            <Navigation />

            <main className="max-w-6xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    {/* Hero Section */}
                    <div className="mb-12">
                        <h1 className="text-5xl font-extrabold sm:text-6xl md:text-7xl bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                            {t("home.title", "SnowShare")}
                        </h1>
                        <p className="mt-6 max-w-3xl mx-auto text-xl text-gray-300 leading-8">
                            {t(
                                "home.description",
                                "Partagez vos fichiers, vos codes et vos URLs en toute sécurité et simplicité."
                            )}
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
                                            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25 scale-105"
                                            : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/70 hover:text-gray-200 hover:scale-105 border border-gray-700/50"
                                    }`}
                                >
                                    <span className="relative z-10">{tab.label}</span>
                                    {activeTab === tab.id && (
                                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-xl"></div>
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
