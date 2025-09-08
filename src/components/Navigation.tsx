"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

export default function Navigation() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t, i18n } = useTranslation()

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push("/")
  }

  const changeLang = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  if (status === "loading") {
    return <div className="bg-gray-800 text-gray-300 p-4">{t('loading')}</div>
  }

  return (
    <nav className="bg-gray-800 border-b border-gray-700 shadow-lg">
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
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2">
              <button onClick={() => changeLang('fr')} className="text-gray-400 hover:text-white text-sm">FR</button>
              <button onClick={() => changeLang('en')} className="text-gray-400 hover:text-white text-sm">EN</button>
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
    </nav>
  )
}
