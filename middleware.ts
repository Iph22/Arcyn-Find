import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/ai-models(.*)',
  '/api/check-url(.*)',
  '/api/reviews(.*)', // Allow public access to read reviews
  '/api/webhooks(.*)', // Allow webhook endpoints (authenticated via webhook secret)
  '/tools(.*)', // Allow browsing tools without auth
  '/about(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/contact(.*)',
  '/community(.*)',
  '/sitemap(.*)', // Allow sitemap routes (sitemap.xml, sitemap-index.xml, sitemap-*.xml)
])

export default clerkMiddleware(async (auth, request) => {
  // Check for maintenance mode
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true'

  if (maintenanceMode) {
    // Allow access to maintenance page itself and static assets
    if (request.nextUrl.pathname === '/maintenance' ||
      request.nextUrl.pathname.startsWith('/_next') ||
      request.nextUrl.pathname.startsWith('/api/webhooks') ||
      request.nextUrl.pathname.startsWith('/sitemap')) {
      return NextResponse.next()
    }

    // Redirect all other requests to maintenance page
    return NextResponse.redirect(new URL('/maintenance', request.url))
  }



  // Create response
  const response = NextResponse.next()

  // Explicitly allow indexing for public routes to override any default noindex headers
  if (isPublicRoute(request)) {
    // Set X-Robots-Tag header to allow indexing for public pages
    response.headers.set('X-Robots-Tag', 'index, follow')
  }

  if (!isPublicRoute(request)) {
    await auth.protect()
  }

  return response
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
