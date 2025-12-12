"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"

interface VersionInfo {
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  releaseUrl?: string
  releaseName?: string
  publishedAt?: string
  releaseNotes?: string
}

export default function UpdateNotification() {
  const { t } = useTranslation()
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch("/api/version")
        if (response.ok) {
          const data = await response.json()
          setVersionInfo(data)
          
          // Check if this version was already dismissed
          const dismissedVersion = localStorage.getItem("snowshare_dismissed_version")
          if (dismissedVersion === data.latestVersion) {
            setDismissed(true)
          }
        }
      } catch (error) {
        console.error("Failed to check version:", error)
      } finally {
        setLoading(false)
      }
    }

    checkVersion()
  }, [])

  const handleDismiss = () => {
    if (versionInfo?.latestVersion) {
      localStorage.setItem("snowshare_dismissed_version", versionInfo.latestVersion)
    }
    setDismissed(true)
  }

  if (loading || !versionInfo?.updateAvailable || dismissed) {
    return null
  }

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg shrink-0">
            <svg 
              className="w-5 h-5 text-blue-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--foreground)]">
              {t("admin.update.title", "Update Available")}
            </h3>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              {t("admin.update.description", "A new version of SnowShare is available.")}
              {" "}
              <span className="font-mono text-xs bg-[var(--surface)] px-1.5 py-0.5 rounded">
                {versionInfo.currentVersion}
              </span>
              {" → "}
              <span className="font-mono text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                {versionInfo.latestVersion}
              </span>
            </p>
            {versionInfo.releaseName && (
              <p className="text-sm text-[var(--foreground-muted)] mt-1">
                <strong>{versionInfo.releaseName}</strong>
              </p>
            )}
            <div className="flex items-center gap-3 mt-3">
              <a
                href={versionInfo.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                {t("admin.update.view_release", "View Release Notes")}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a
                href="https://github.com/TuroYT/snowshare/blob/main/docs/UPGRADE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {t("admin.update.upgrade_guide", "Upgrade Guide")}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded-lg transition-colors shrink-0"
          title={t("admin.update.dismiss", "Dismiss")}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
