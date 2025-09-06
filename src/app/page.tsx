"use client"

import { useSession } from "next-auth/react"
import Navigation from "@/components/Navigation"
import { useState } from "react"
import LinkShare from "@/components/LinkShare"
import PasteShare from "@/components/PasteShare"
import FileShare from "@/components/FileShare"

export default function Home() {
  const { data: session } = useSession()
   const [activeTab, setActiveTab] = useState("linkshare")

  const tabs = [
    { id: "linkshare", label: "LinkShare", component: <LinkShare /> },
    { id: "pasteshare", label: "PasteShare", component: <PasteShare /> },
    { id: "fileshare", label: "FileShare", component: <FileShare /> },
  ]


  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-100 sm:text-5xl md:text-6xl">
            Bienvenue sur SnowShare
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-400 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Partagez vos fichiers, vos codes et vos URLs en toute sécurité et simplicité.
          </p>
          
{/* Tabs */}
          <div className="mt-8">
            <div className="flex justify-center space-x-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              {tabs.find((tab) => tab.id === activeTab)?.component}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  )
}
