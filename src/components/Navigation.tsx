"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useState, useEffect, useRef } from "react"
import { useTheme } from "@/hooks/useTheme"

export default function Navigation() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { branding } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [allowSignup, setAllowSignup] = useState(true)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Fetch signup status from database
  useEffect(() => {
    const fetchSignupStatus = async () => {
      try {
        const response = await fetch("/api/setup/check")
        if (response.ok) {
          const data = await response.json()
          setAllowSignup(data.allowSignup ?? true)
        }
      } catch (error) {
        console.error("Error fetching signup status:", error)
        setAllowSignup(true) // Default to true on error
      }
    }

    fetchSignupStatus()
  }, [])

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

  // Fetch user's profile to determine admin status (endpoint returns { isAdmin })
  useEffect(() => {
    fetch('/api/user/profile')
      .then((res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        if (!data) return
        setIsAdmin(data.user.isAdmin)
      })
  }, [status])

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
    return <div className="bg-[var(--surface)] text-[var(--foreground)] p-4">{t('loading')}</div>
  }
  return (
    <nav className="bg-[var(--surface)]/90 backdrop-blur-md border-b border-[var(--border)]/50 shadow-2xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[var(--primary)]/20 group-hover:bg-[var(--primary)]/30 transition-colors"></div>
                {branding.logoUrl ? (
                  <Image src={branding.logoUrl} alt={`${branding.appName} Logo`} width={36} height={36} className="relative z-10 rounded-full object-contain" />
                ) : (
                  <Image src="/logo.svg" alt={`${branding.appName} Logo`} width={36} height={36} className="relative z-10" />
                )}
              </div>
              <span 
                className="text-xl font-bold bg-clip-text text-transparent group-hover:opacity-80 transition-all"
                style={{ backgroundImage: `linear-gradient(to right, ${branding.primaryColor}, ${branding.accentColor})` }}
              >
                {branding.appName}
              </span>
            </Link>
          </div>
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              className="sm:hidden inline-flex items-center justify-center p-2 rounded-xl text-[var(--foreground-muted)] hover:text-white hover:bg-[var(--surface)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
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
                  className="bg-[var(--surface)]/50 border border-[var(--border)]/50 text-[var(--foreground)] text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all hover:bg-[var(--surface)]/50"
                >
                  {languages.map((lng) => (
                    <option key={lng.code} value={lng.code} className="bg-[var(--surface)] text-[var(--foreground)]">{lng.label}</option>
                  ))}
                </select>
              </div>

              {session ? (
                <div className="flex items-center space-x-4">
                  <div className="relative" ref={profileMenuRef}>
                    <button
                      onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                      className="flex items-center space-x-2 hover:bg-[var(--surface)]/50 px-3 py-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--primary), var(--secondary))' }}>
                        <span className="text-white text-sm font-medium">
                          {session.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || session.user?.email?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[var(--foreground)] text-sm max-w-[120px] truncate">{session.user?.name || session.user?.email}</span>
                      <svg
                        className={`w-4 h-4 text-[var(--foreground-muted)] transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {profileMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[var(--surface)] border border-[var(--border)]/50 shadow-xl backdrop-blur-md overflow-hidden z-50">
                        <div className="py-2">
                          <Link
                            href="/profile"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-[var(--foreground)] hover:bg-[var(--surface)]/50 hover:text-white transition-all group"
                          >
                            <div className="h-8 w-8 rounded-lg border border-[var(--primary-dark)]/50 flex items-center justify-center group-hover:border-[var(--primary)]/70 transition-colors" style={{ background: 'linear-gradient(to bottom right, rgb(from var(--primary) r g b / 0.2), rgb(from var(--primary-dark) r g b / 0.2))' }}>
                              <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                              <div className="text-xs text-[var(--foreground-muted)]">{t('nav.profile_desc', 'Gérer mes infos')}</div>
                            </div>
                          </Link>
                          
                          {isAdmin && (
                            <>
                              <div className="border-t border-[var(--border)]/50 my-2"></div>
                              <Link
                                href="/admin"
                                onClick={() => setProfileMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 text-[var(--foreground)] hover:bg-[var(--surface)]/50 hover:text-white transition-all group"
                              >
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-700/50 flex items-center justify-center group-hover:border-yellow-600/70 transition-colors">
                                  <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{t('nav.admin', 'Admin')}</div>
                                  <div className="text-xs text-[var(--foreground-muted)]">{t('nav.admin_desc', 'Panneau d\'administration')}</div>
                                </div>
                              </Link>
                            </>
                          )}
                          <div className="border-t border-[var(--border)]/50 my-2"></div>

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
                              <div className="text-xs text-[var(--foreground-muted)]">{t('nav.signout_desc', 'Se déconnecter')}</div>
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
                    className="text-[var(--foreground)] hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-[var(--surface)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    {t('nav.signin')}
                  </Link>
                  {allowSignup && (
                    <Link
                      href="/auth/signup"
                      className="text-white px-5 py-2 rounded-xl text-sm font-medium transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      style={{ background: 'linear-gradient(to right, var(--primary), var(--secondary))', boxShadow: '0 10px 15px -3px rgb(from var(--primary) r g b / 0.25)' }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 20px 25px -5px rgb(from var(--primary) r g b / 0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(from var(--primary) r g b / 0.25)'}
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
        <div className="sm:hidden border-t border-[var(--border)]/50 bg-[var(--surface)]/95 backdrop-blur-md px-4 py-4">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center gap-2">
              <label htmlFor="lang-select-mobile" className="sr-only">{t('nav.language') || 'Language'}</label>
              <select
                id="lang-select-mobile"
                value={currentLang}
                onChange={(e) => changeLang(e.target.value, true)}
                className="bg-[var(--surface)]/50 border border-[var(--border)]/50 text-[var(--foreground)] text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)] w-full"
              >
                {languages.map((lng) => (
                  <option key={lng.code} value={lng.code} className="bg-[var(--surface)]">{lng.label}</option>
                ))}
              </select>
            </div>

            {session ? (
              <>
                <div className="flex items-center space-x-3 py-2">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--primary), var(--secondary))' }}>
                    <span className="text-white font-medium">
                      {session.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || session.user?.email?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[var(--foreground)] text-sm truncate">{session.user?.name || session.user?.email}</span>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--foreground)] hover:bg-[var(--surface)]/50 hover:text-white transition-all"
                >
                  <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span className="text-sm font-medium">{t('nav.profile', 'Mon Profil')}</span>
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--foreground)] hover:bg-[var(--surface)]/50 hover:text-white transition-all"
                  >
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                    </svg>
                    <span className="text-sm font-medium">{t('nav.admin', 'Panneau d\'Administration')}</span>
                  </Link>
                )}

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
                  className="text-[var(--foreground)] hover:text-white block px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-[var(--surface)]/50"
                >
                  {t('nav.signin')}
                </Link>
                {allowSignup && (
                  <Link
                    href="/auth/signup"
                    onClick={() => setMobileOpen(false)}
                    className="text-white block px-4 py-3 rounded-xl text-sm font-medium transition-all text-center"
                    style={{ background: 'linear-gradient(to right, var(--primary), var(--secondary))' }}
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
