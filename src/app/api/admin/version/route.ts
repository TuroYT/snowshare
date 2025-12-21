import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import fs from "fs"
import path from "path"

const GITHUB_REPO = "TuroYT/snowshare"

function getCurrentVersion(): string {
  const envVersion = process.env.npm_package_version || process.env.NPM_PACKAGE_VERSION || process.env.NEXT_PUBLIC_VERSION
  if (envVersion) return envVersion
  try {
    const pkgPath = path.join(process.cwd(), "package.json")
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
    return pkg?.version || "0.1.0"
  } catch (e) {
    return "0.1.0"
  }
}

const CURRENT_VERSION = getCurrentVersion()

interface GitHubRelease {
  tag_name: string
  name: string
  html_url: string
  published_at: string
  body: string
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Fetch latest release from GitHub
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "SnowShare-Version-Check"
        },
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        // No releases found
        return NextResponse.json({
          currentVersion: CURRENT_VERSION,
          latestVersion: null,
          updateAvailable: false,
          message: "No releases found"
        })
      }
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const release: GitHubRelease = await response.json()
    const latestVersion = release.tag_name.replace(/^v/, "")
    const updateAvailable = compareVersions(latestVersion, CURRENT_VERSION) > 0

    return NextResponse.json({
      currentVersion: CURRENT_VERSION,
      latestVersion,
      updateAvailable,
      releaseUrl: release.html_url,
      releaseName: release.name,
      publishedAt: release.published_at,
      releaseNotes: release.body
    })
  } catch (error) {
    console.error("Version check error:", error)
    return NextResponse.json(
      { error: "Failed to check version" },
      { status: 500 }
    )
  }
}

// Compare two semver versions
// Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number)
  const parts2 = v2.split(".").map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  return 0
}
