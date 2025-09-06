"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"

const MAX_DAYS_ANON = 7
const MAX_DAYS_AUTH = 365

const LinkShare: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const [url, setUrl] = useState("")
  const [expiresDays, setExpiresDays] = useState<number>(
    isAuthenticated ? 30 : MAX_DAYS_ANON
  )
  const [neverExpires, setNeverExpires] = useState(false)
  const [slug, setSlug] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  function isValidUrl(value: string) {
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  }

  const handleUrlChange = (value: string) => {
    setUrl(value)
    setUrlError(null)
    
    if (value.trim() && !isValidUrl(value.trim())) {
      setUrlError("Format d'URL invalide")
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erreur lors de la copie:', err)
    }
  }

  const getDurationText = () => {
    if (isAuthenticated && neverExpires) {
      return "Ce lien n'expirera jamais"
    }
    const days = expiresDays
    if (days === 1) return "Ce lien expirera dans 1 jour"
    if (days < 7) return `Ce lien expirera dans ${days} jours`
    if (days === 7) return "Ce lien expirera dans 1 semaine"
    if (days < 30) return `Ce lien expirera dans ${Math.round(days / 7)} semaines`
    if (days === 30) return "Ce lien expirera dans 1 mois"
    if (days < 365) return `Ce lien expirera dans ${Math.round(days / 30)} mois`
    return `Ce lien expirera dans ${Math.round(days / 365)} an(s)`
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && url.trim() && !urlError && !loading) {
        e.preventDefault()
        const form = document.querySelector('form')
        if (form) {
          form.requestSubmit()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [url, urlError, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!url.trim()) {
      setError("L'URL est requise")
      return
    }

    if (!isValidUrl(url.trim())) {
      setError("L'URL fournie n'est pas valide")
      return
    }

    // Apply caps: non-authenticated users cannot set more than MAX_DAYS_ANON
    // For authenticated users, allow no expiration if neverExpires is true
    let expiresAt: string | null = null
    
    if (!isAuthenticated || !neverExpires) {
      const cap = isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON
      const days = Math.max(1, Math.min(Number(expiresDays) || 1, cap))
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    }

    const payload: Record<string, unknown> = {
      type: "URL",
      urlOriginal: url.trim(),
    }

    if (expiresAt) payload.expiresAt = expiresAt

    if (slug.trim()) payload.slug = slug.trim()
    if (password.trim()) payload.password = password.trim()

    try {
      setLoading(true)


      // envoie du payload au backend
      // exemple de payload:
        // {
        //   type: "URL",
        //   urlOriginal: "https://example.com",
        //   expiresAt: "2024-12-31T23:59:59.000Z", // optional
        //   slug: "mon-slug",                     // optional
        //   password: "mon-mot-de-passe"          // optional
        // }
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || "Erreur lors de la création du partage")
      } else {
        // Expect backend to return the created share (slug or full URL)
        const returned = data?.share || data
        const returnedSlug = returned?.slug || returned?.id || null
        if (returnedSlug) {
          setSuccess(`${window.location.origin}/s/${returnedSlug}`)
        } else if (data?.url) {
          setSuccess(String(data.url))
        } else {
          setSuccess("Partage créé")
        }
        // Reset form except url for convenience
        setUrl("")
        setSlug("")
        setPassword("")
        setNeverExpires(false)
        setUrlError(null)
      }
    } catch (error) {
      // Log for diagnostics and show a generic message to the user
      console.error("LinkShare error:", error)
      setError("Erreur réseau — impossible de créer le partage")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Partager un lien</h2>
          <p className="text-sm text-gray-400">Créez un lien partageable pour n&apos;importe quelle URL</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">{/* Enhanced URL input */}
        <div className="space-y-2">
          <label htmlFor="url" className="block text-sm font-medium text-gray-300">
            URL à partager <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="url"
              type="url"
              placeholder="https://exemple.com/ma-page"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              required
              className={`w-full rounded-lg border ${urlError ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500'} bg-gray-700 text-gray-100 px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:border-transparent placeholder-gray-400 transition-colors`}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {url && isValidUrl(url) && (
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          {urlError && (
            <p className="text-xs text-red-400 mt-1">{urlError}</p>
          )}
        </div>

        {/* Enhanced expiration settings */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Durée de validité
          </label>
          
          {isAuthenticated && (
            <div className="bg-gray-750 p-3 rounded-lg border border-gray-600">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={neverExpires}
                  onChange={(e) => setNeverExpires(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-2 focus:ring-offset-0"
                />
                <div>
                  <div className="text-sm font-medium text-gray-200">Aucune expiration</div>
                  <div className="text-xs text-gray-400">Ce lien restera actif indéfiniment</div>
                </div>
              </label>
            </div>
          )}
          
          <div className={`flex items-center gap-3 ${isAuthenticated && neverExpires ? 'opacity-50' : ''}`}>
            <div className="flex-1">
              <input
                id="expires"
                type="number"
                min={1}
                max={isAuthenticated ? MAX_DAYS_AUTH : MAX_DAYS_ANON}
                value={expiresDays}
                onChange={(e) => setExpiresDays(Number(e.target.value))}
                disabled={isAuthenticated && neverExpires}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 text-gray-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <span className="text-sm text-gray-400 min-w-0">jours</span>
          </div>
          
          <div className="text-xs text-gray-400 bg-gray-750 p-2 rounded border border-gray-600">
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{getDurationText()}</span>
            </div>
          </div>
          
          {!isAuthenticated && (
            <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded p-2">
              💡 Connectez-vous pour des durées plus longues (jusqu&apos;à {MAX_DAYS_AUTH} jours) ou sans expiration
            </p>
          )}
        </div>

        {/* Enhanced optional settings */}
        <div className="bg-gray-750 p-4 rounded-lg border border-gray-600 space-y-4">
          <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
            Paramètres avancés (optionnel)
          </h3>
          
          <div className="space-y-3">
            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-300 mb-2">
                Lien personnalisé
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 whitespace-nowrap">{window.location.origin}/s/</span>
                <input
                  id="slug"
                  type="text"
                  placeholder="mon-lien-custom"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  pattern="[a-zA-Z0-9-_]+"
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-700 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Lettres, chiffres, tirets et underscores uniquement</p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Protection par mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  placeholder="Optionnel - laissez vide pour un accès libre"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 text-gray-100 px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced submit button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !url.trim() || !!urlError}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Création en cours...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                Créer le lien partagé
              </>
            )}
          </button>
          
          {!loading && url.trim() && !urlError && (
            <p className="text-xs text-gray-400 text-center mt-2">
              💡 Astuce : <kbd className="px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs">Entrée</kbd> pour créer rapidement
            </p>
          )}
        </div>
      </form>

      {/* Enhanced error display */}
      {error && (
        <div role="alert" className="mt-6 bg-red-900/20 border border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-red-300 mb-1">Erreur</h4>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced success display */}
      {success && (
        <div role="status" className="mt-6 bg-green-900/20 border border-green-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-green-300 mb-2">Lien créé avec succès !</h4>
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 flex items-center gap-3">
                <a 
                  href={success} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 text-sm text-blue-400 hover:text-blue-300 underline break-all min-w-0"
                >
                  {success}
                </a>
                <button
                  onClick={() => copyToClipboard(success)}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  title="Copier le lien"
                >
                  {copied ? (
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-400 mt-2">✓ Copié dans le presse-papiers</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LinkShare
