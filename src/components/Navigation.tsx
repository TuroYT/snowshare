"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useState } from "react"

export default function Navigation() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
  setMobileOpen(false)
  await signOut({ redirect: false })
  router.push("/")
  }

  // Supported languages. Add more entries here if needed.
  const languages = [
    { code: 'en', label: 'EN' },
    { code: 'fr', label: 'FR' },
  ]

  // changeLang optionally closes the mobile menu and persists choice to localStorage.
  const changeLang = (lng: string, closeMenu = false) => {
    i18n.changeLanguage(lng)
    try {
      localStorage.setItem('i18nextLng', lng)
    } catch {
      // ignore if not available
    }
    if (closeMenu) setMobileOpen(false)
  }

  const currentLang = (i18n.language || 'en').split('-')[0]

  if (status === "loading") {
    return <div className="bg-gray-800 text-gray-300 p-4">{t('loading')}</div>
  }

  return (
    <nav className="bg-gray-800 border-b border-gray-700 shadow-lg relative">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.svg" alt="SnowShare Logo" width={36} height={36} />
              <span className="text-xl font-bold text-gray-100 hover:text-white transition-colors">
                SnowShare
              </span>
            </Link>
          </div>
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              className="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
              onClick={() => setMobileOpen((s) => !s)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Desktop links */}
            <div className="hidden sm:flex items-center space-x-4 ml-3">
              <div className="flex items-center gap-2">
                <label htmlFor="lang-select" className="sr-only">{t('nav.language') || 'Language'}</label>
                <select
                  id="lang-select"
                  value={currentLang}
                  onChange={(e) => changeLang(e.target.value)}
                  className="bg-transparent border border-gray-700 text-gray-300 text-sm px-2 py-1 rounded-md focus:outline-none"
                >
                  {languages.map((lng) => (
                    <option key={lng.code} value={lng.code} className="text-gray-900">{lng.label}</option>
                  ))}
                </select>
              </div>

              {session ? (
                <>
                  <span className="text-gray-400">{t('nav.hello', { email: session.user?.email })}</span>
                  <button
                    onClick={handleSignOut}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    {t('nav.signout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    className="text-gray-400 hover:text-gray-200 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    {t('nav.signin')}
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    {t('nav.signup')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-700 bg-gray-800 px-4 py-3">
          <div className="flex flex-col space-y-3">
            <div className="flex items-center gap-2">
              <label htmlFor="lang-select-mobile" className="sr-only">{t('nav.language') || 'Language'}</label>
              <select
                id="lang-select-mobile"
                value={currentLang}
                onChange={(e) => changeLang(e.target.value, true)}
                className="bg-transparent border border-gray-700 text-gray-300 text-sm px-2 py-1 rounded-md focus:outline-none"
              >
                {languages.map((lng) => (
                  <option key={lng.code} value={lng.code}>{lng.label}</option>
                ))}
              </select>
            </div>

            {session ? (
              <>
                <span className="text-gray-400">{t('nav.hello', { email: session.user?.email })}</span>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {t('nav.signout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  onClick={() => setMobileOpen(false)}
                  className="text-gray-400 hover:text-gray-200 block px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {t('nav.signin')}
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setMobileOpen(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white block px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {t('nav.signup')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
