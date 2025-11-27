import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export const runtime = 'nodejs';

// Helper function to add security headers
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  // Enable browser XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block')
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // Permissions policy
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  return response
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip setup check for setup page, API routes, and static assets
  if (
    pathname.startsWith('/setup') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/')
  ) {
    const response = NextResponse.next()
    return addSecurityHeaders(response)
  }

  // Check if setup is needed
  try {
    const baseUrl = "http://localhost:" + process.env.PORT || "3000"
    const checkUrl = new URL('/api/setup/check', baseUrl)
    console.log(checkUrl.toString())
    const response = await fetch(checkUrl.toString())
    
    if (!response.ok) {
      // If we can't check setup status, fail open to avoid lockout
      console.error('Setup check failed with status:', response.status)
      const nextResponse = NextResponse.next()
      return addSecurityHeaders(nextResponse)
    }
    
    const data = await response.json()

    if (data.needsSetup) {
      // Redirect to setup page if not already there
      const redirectResponse = NextResponse.redirect(new URL('/setup', request.url))
      return addSecurityHeaders(redirectResponse)
    }
  } catch (error) {
    // If setup check fails due to network/database issues, fail open to avoid lockout
    console.error('Error checking setup status:', error)
    const nextResponse = NextResponse.next()
    return addSecurityHeaders(nextResponse)
  }

  // Check authentication for protected routes
  const protectedPaths = ['/dashboard', '/profile', '/api/protected']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))

  if (isProtectedPath) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      const redirectResponse = NextResponse.redirect(signInUrl)
      return addSecurityHeaders(redirectResponse)
    }
  }


  const response = NextResponse.next()
  return addSecurityHeaders(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}
