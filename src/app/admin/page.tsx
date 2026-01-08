"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import Navigation from "@/components/Navigation"
import Footer from "@/components/Footer"
import UsersTab from "@/components/admin/UsersTab"
import SettingsTab from "@/components/admin/SettingsTab"
import LogsTab from "@/components/admin/LogsTab"
import BrandingTab from "@/components/admin/BrandingTab"
import OAuthProvidersTab from "@/components/admin/OAuthProvidersTab"
import UpdateNotification, { VersionInfo } from "@/components/admin/UpdateNotification"

type Tab = "users" | "settings" | "branding" | "logs" | "oauth"

export default function AdminPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
   const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("users")

  const checkAdminStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/user/profile")
      if (!response.ok) {
        throw new Error("Failed to fetch profile")
      }
      const data = await response.json()
      if (data.user.isAdmin) {
        setIsAdmin(true)
      } else {
        router.push("/")
      }
    } catch (error) {
      console.error("Error checking admin status:", error)
      router.push("/")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (status === "authenticated") {
      checkAdminStatus()
    }
  }, [status, router, checkAdminStatus])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="mt-4">{t("admin.loading")}</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="inline-block rounded-full p-3 bg-red-600/10 border border-red-600/20 mb-4">
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">{t("admin.error_access_denied")}</h1>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
      <Navigation />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
              {t("admin.title")} - v{versionInfo?.currentVersion ?? "loading..."}
            </h1>
            <p className="text-[var(--foreground-muted)]">{t("admin.subtitle")}</p>
          </div>

          {/* Update Notification */}
          <UpdateNotification versionInfo={versionInfo} setVersionInfo={setVersionInfo} />

          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-[var(--border)]/50 overflow-x-auto">
            {(["users", "settings", "branding", "oauth", "logs"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium transition-all whitespace-nowrap border-b-2 ${
                  activeTab === tab
                    ? "border-blue-500 text-[var(--primary)]"
                    : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab === "oauth" ? "OAuth / SSO" : t(`admin.tabs.${tab}`)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-[var(--surface)] bg-opacity-95 border border-[var(--border)]/50 rounded-2xl p-6">
            {activeTab === "users" && <UsersTab />}
            {activeTab === "settings" && <SettingsTab />}
            {activeTab === "branding" && <BrandingTab />}
            {activeTab === "oauth" && <OAuthProvidersTab />}
            {activeTab === "logs" && <LogsTab />}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}