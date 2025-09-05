"use client"

import { useSession } from "next-auth/react"
import Navigation from "@/components/Navigation"

export default function Home() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            Bienvenue sur SnowShare
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Partagez vos fichiers, vos codes et vos URLs en toute sécurité et simplicité.
          </p>
          
          {session ? (
            <div className="mt-8">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    Tableau de bord
                  </h2>
                  <p className="text-gray-600">
                    Connecté en tant que: {session.user?.email}
                  </p>
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="bg-indigo-50 p-4 rounded-lg">
                      <h3 className="font-medium text-indigo-900">Partager un fichier</h3>
                      <p className="text-sm text-indigo-700 mt-1">
                        Uploadez et partagez vos fichiers
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-medium text-green-900">Partager du code</h3>
                      <p className="text-sm text-green-700 mt-1">
                        Partagez vos snippets de code
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-medium text-blue-900">Partager une URL</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Raccourcissez vos URLs
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <p className="text-gray-600 mb-4">
                Connectez-vous pour commencer à partager vos contenus.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
