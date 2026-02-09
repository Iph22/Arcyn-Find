import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/sign-in',
  '/sign-up',
  '/api/auth',
  '/api/ai-models',
  '/api/check-url',
  '/api/reviews',
  '/api/webhooks',
  '/tools',
  '/about',
  '/privacy',
  '/terms',
  '/contact',
  '/community',
  '/sitemap',
]

// Routes that require authentication
const protectedRoutes = [
  '/home',
  '/profile',
  '/settings',
  '/collections',
  '/onboarding',
  '/instructions',
  '/followers',
  '/reviews',
]

function isPublicRoute(pathname: string): boolean {
  // Check exact matches first
  if (publicRoutes.includes(pathname)) return true

  // Check prefix matches
  return publicRoutes.some(route =>
    pathname.startsWith(route + '/') || pathname.startsWith(route + '?')
  )
}

function isProtectedRoute(pathname: string): boolean {
  if (protectedRoutes.includes(pathname)) return true
  return protectedRoutes.some(route => pathname.startsWith(route + '/'))
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for maintenance mode
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true'

  if (maintenanceMode) {
    // Allow access to maintenance page itself and static assets
    if (pathname === '/maintenance' ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/webhooks') ||
      pathname.startsWith('/sitemap')) {
      return NextResponse.next()
    }

    // Redirect all other requests to maintenance page
    return NextResponse.redirect(new URL('/maintenance', request.url))
  }

  // Create response
  const response = NextResponse.next()

  // Explicitly allow indexing for public routes
  if (isPublicRoute(pathname)) {
    response.headers.set('X-Robots-Tag', 'index, follow')
  }

  // Check authentication for protected routes
  if (isProtectedRoute(pathname)) {
    const sessionCookie = request.cookies.get('arcyn_session')

    if (!sessionCookie?.value) {
      // Not authenticated - redirect to sign-in
      const signInUrl = new URL('/sign-in', request.url)
      signInUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(signInUrl)
    }

    try {
      // Parse session to validate it
      const session = JSON.parse(atob(sessionCookie.value))

      // Check if session is expired
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        const signInUrl = new URL('/sign-in', request.url)
        signInUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(signInUrl)
      }
    } catch (error) {
      // Invalid session - redirect to sign-in
      const signInUrl = new URL('/sign-in', request.url)
      signInUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(signInUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt|json)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
