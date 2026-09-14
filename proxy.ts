import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
// Relative rather than the `@/` alias: proxy.ts sits at the project root and is
// bundled separately from the app, so this resolves identically everywhere.
import { SESSION_COOKIE_NAME, verifySession } from './lib/session'

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
  // The public SEO layer. `/tools` covers /tools, /tools/<slug> and
  // /tools/category/* via the prefix match below.
  '/tools',
  '/browse',
  '/about',
  '/privacy',
  '/terms',
  '/contact',
  '/community',
  '/sitemap',
  '/robots.txt',
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

export async function proxy(request: NextRequest) {
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

  // No blanket X-Robots-Tag here. It used to stamp `index, follow` on every
  // public route, which would now override the per-page `noindex` that the
  // SEO layer applies to thin tool pages and to the /browse filter UI.
  // Indexability is decided in one place: each page's generateMetadata.

  // Check authentication for protected routes.
  //
  // This is the optimistic check the Next.js docs describe -- it keeps signed-out
  // visitors off protected pages without a database round trip. It is not the
  // authorisation boundary: every route handler independently calls
  // getCurrentUser(), which verifies the same cookie server-side.
  //
  // It used to `JSON.parse(atob(...))` the cookie, which authenticated anything
  // shaped like a session. It now verifies the HMAC, so a forged or edited
  // cookie fails here for the same reason it fails in the route handlers.
  if (isProtectedRoute(pathname)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
    const session = await verifySession(sessionCookie?.value)

    if (!session) {
      const signInUrl = new URL('/sign-in', request.url)
      signInUrl.searchParams.set('redirect', pathname)

      const redirect = NextResponse.redirect(signInUrl)

      // Clear the rejected cookie so the browser stops replaying it. Without
      // this, every cookie minted by the old unsigned scheme is re-sent on each
      // navigation and re-rejected until it expires 30 days later.
      if (sessionCookie?.value) {
        redirect.cookies.delete(SESSION_COOKIE_NAME)
      }

      return redirect
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
