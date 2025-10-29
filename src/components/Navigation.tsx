"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useState, useEffect, useRef } from "react"

export default function Navigation() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  
  // Check if signup is allowed via environment variable
  const allowSignup = process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== 'false'
 
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }

    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [profileMenuOpen])

  const handleSignOut = async () => {
  setMobileOpen(false)
  setProfileMenuOpen(false)
  await signOut({ redirect: false })
  router.push("/")
  }

  // Supported languages. Add more entries here if needed.
  const languages = [
    { code: 'fr', label: 'FR' },
    { code: 'en', label: 'EN' },
    { code: 'es', label: 'ES' },
    { code: 'de', label: 'DE' },
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
    <nav className="bg-gray-800/90 backdrop-blur-md border-b border-gray-700/50 shadow-2xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors"></div>
                <Image src="/logo.svg" alt="SnowShare Logo" width={36} height={36} className="relative z-10" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:to-purple-300 transition-all">
                SnowShare
              </span>
            </Link>
          </div>
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              className="sm:hidden inline-flex items-center justify-center p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
            <div className="hidden sm:flex items-center space-x-4 ml-6">
              <div className="flex items-center gap-2">
                <label htmlFor="lang-select" className="sr-only">{t('nav.language') || 'Language'}</label>
                <select
                  id="lang-select"
                  value={currentLang}
                  onChange={(e) => changeLang(e.target.value)}
                  className="bg-gray-800/50 border border-gray-600/50 text-gray-300 text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:bg-gray-700/50"
                >
                  {languages.map((lng) => (
                    <option key={lng.code} value={lng.code} className="bg-gray-800 text-gray-300">{lng.label}</option>
                  ))}
                </select>
              </div>

              {session ? (
                <div className="flex items-center space-x-4">
                  <div className="relative" ref={profileMenuRef}>
                    <button
                      onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                      className="flex items-center space-x-2 hover:bg-gray-700/50 px-3 py-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {session.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || session.user?.email?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-gray-300 text-sm max-w-[120px] truncate">{session.user?.name || session.user?.email}</span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {profileMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 rounded-xl bg-gray-800 border border-gray-700/50 shadow-xl backdrop-blur-md overflow-hidden z-50">
                        <div className="py-2">
                          <Link
                            href="/profile"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all group"
                          >
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-700/50 flex items-center justify-center group-hover:border-blue-600/70 transition-colors">
                              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium">{t('nav.profile', 'Mon Profil')}</div>
                              <div className="text-xs text-gray-500">{t('nav.profile_desc', 'Gérer mes infos')}</div>
                            </div>
                          </Link>

                          <div className="border-t border-gray-700/50 my-2"></div>

                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-all w-full group"
                          >
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-700/50 flex items-center justify-center group-hover:border-red-600/70 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                />
                              </svg>
                            </div>
                            <div className="flex-1 text-left">
                              <div className="text-sm font-medium">{t('nav.signout', 'Déconnexion')}</div>
                              <div className="text-xs text-gray-500">{t('nav.signout_desc', 'Se déconnecter')}</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {t('nav.signin')}
                  </Link>
                  {allowSignup && (
                    <Link
                      href="/auth/signup"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all hover:shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {t('nav.signup')}
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-700/50 bg-gray-800/95 backdrop-blur-md px-4 py-4">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center gap-2">
              <label htmlFor="lang-select-mobile" className="sr-only">{t('nav.language') || 'Language'}</label>
              <select
                id="lang-select-mobile"
                value={currentLang}
                onChange={(e) => changeLang(e.target.value, true)}
                className="bg-gray-800/50 border border-gray-600/50 text-gray-300 text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              >
                {languages.map((lng) => (
                  <option key={lng.code} value={lng.code} className="bg-gray-800">{lng.label}</option>
                ))}
              </select>
            </div>

            {session ? (
              <>
                <div className="flex items-center space-x-3 py-2">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-medium">
                      {session.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || session.user?.email?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-gray-300 text-sm truncate">{ session.user?.name || session.user?.email}</span>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all"
                >
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span className="text-sm font-medium">{t('nav.profile', 'Mon Profil')}</span>
                </Link>

                <button
                  onClick={handleSignOut}
                  className="w-full text-left flex items-center gap-3 bg-red-600/90 hover:bg-red-700 text-white px-4 py-3 rounded-xl text-sm font-medium transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>{t('nav.signout', 'Déconnexion')}</span>
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/auth/signin"
                  onClick={() => setMobileOpen(false)}
                  className="text-gray-300 hover:text-white block px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-gray-700/50"
                >
                  {t('nav.signin')}
                </Link>
                {allowSignup && (
                  <Link
                    href="/auth/signup"
                    onClick={() => setMobileOpen(false)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white block px-4 py-3 rounded-xl text-sm font-medium transition-all text-center"
                  >
                    {t('nav.signup')}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
