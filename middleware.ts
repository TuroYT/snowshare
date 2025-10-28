import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip setup check for setup page, API routes, and static assets
  if (
    pathname.startsWith('/setup') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/')
  ) {
    return NextResponse.next()
  }

  // Check if setup is needed
  try {
    const baseUrl = request.nextUrl.origin
    const checkUrl = new URL('/api/setup/check', baseUrl)
    const response = await fetch(checkUrl.toString())
    const data = await response.json()

    if (data.needsSetup) {
      // Redirect to setup page if not already there
      return NextResponse.redirect(new URL('/setup', request.url))
    }
  } catch (error) {
    console.error('Error checking setup status:', error)
  }

  // Check authentication for protected routes
  const protectedPaths = ['/dashboard', '/profile', '/api/protected']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))

  if (isProtectedPath) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}
