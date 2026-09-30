/**
 * What host is this request on, and do we trust it?
 *
 * Extracted from lib/oauth-redirect.ts, which needed it first and is not the
 * only thing that needs it. Anything that builds an absolute URL to hand back
 * to a person -- an OAuth callback, a link in an email -- has to build it from
 * the deployment they are actually using.
 *
 * WHY NOT siteUrl()
 *
 * siteUrl() answers a different question: what is the canonical public origin,
 * for canonical tags and sitemaps. It accepts only https and falls back to the
 * production domain, which is right for a canonical URL and wrong for a link
 * somebody has to click: on a local server NEXT_PUBLIC_SITE_URL is
 * http://localhost:3000, that fails the https test, and the link silently
 * points at production. A review email did exactly that -- tapping Approve
 * opened arcynfind.com and 404ed, because the page only exists locally.
 *
 * ON HOST HEADERS AND TRUST
 *
 * The host is attacker-controllable in principle, so this allowlists rather
 * than echoing it, and an unrecognised host falls back to the configured site
 * URL instead of becoming a link target.
 */

import { PRODUCTION_ORIGIN } from './seo/site'

/**
 * The origin this request is really being served on.
 *
 * `x-forwarded-*` first because the app sits behind Vercel's proxy, where
 * `request.url` can carry the internal host rather than the one the browser
 * used.
 */
function requestOrigin(request: Request): string | null {
  const headers = request.headers
  const forwardedHost = headers.get('x-forwarded-host')
  const host = forwardedHost || headers.get('host')

  if (host) {
    const proto = headers.get('x-forwarded-proto') || 'https'
    // A comma-separated list appears when more than one proxy has appended to
    // it; the first entry is the one nearest the client.
    const firstHost = host.split(',')[0].trim()
    const firstProto = proto.split(',')[0].trim()
    if (firstHost) return `${firstProto}://${firstHost}`
  }

  try {
    return new URL(request.url).origin
  } catch {
    return null
  }
}

/** Origins this app is willing to be signed in on. */
export function isAllowedOAuthOrigin(origin: string): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) {
    try {
      if (new URL(configured).origin === url.origin) return true
    } catch {
      // A malformed NEXT_PUBLIC_SITE_URL simply does not match anything.
    }
  }

  // The production apex and any subdomain of it. `preview.arcynfind.com` is
  // bound to the `main` branch in Vercel and is the stable URL to verify an
  // authenticated page on before promoting -- unlike a per-deployment
  // *.vercel.app host, which changes on every push and so cannot be registered
  // in the Google Cloud Console once and left alone.
  //
  // Anchored on a leading dot against the apex, so `arcynfind.com.evil.test`
  // does not match: it ends with `.evil.test`, not with `.arcynfind.com`.
  const apex = new URL(PRODUCTION_ORIGIN).hostname
  if (url.protocol === 'https:' && (url.hostname === apex || url.hostname.endsWith(`.${apex}`))) {
    return true
  }

  // Vercel preview deployments. The host is generated per deployment, so it
  // cannot be enumerated; what can be required is that it is a Vercel
  // deployment of this project over https. Each one still has to be registered
  // in the Google Cloud Console before sign-in works there -- prefer the
  // stable per-branch alias (arcyn-find-git-<branch>-<scope>.vercel.app) over
  // the per-deployment URL, which changes on every push.
  if (url.protocol === 'https:' && url.hostname.endsWith('.vercel.app')) return true

  // Local development, where NEXT_PUBLIC_SITE_URL is http://localhost:3000 and
  // therefore already matched above -- this covers a different port.
  if (
    process.env.NODE_ENV !== 'production' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  ) {
    return true
  }

  return false
}

/**
 * The origin to build a user-facing absolute URL on, falling back to the
 * configured site URL when the request's own host is not recognised.
 */
export function appOrigin(request: Request): string {
  const origin = requestOrigin(request)
  if (origin && isAllowedOAuthOrigin(origin)) return origin

  const configured = process.env.NEXT_PUBLIC_SITE_URL
  return configured && /^https?:\/\//i.test(configured)
    ? configured.replace(/\/+$/, '')
    : PRODUCTION_ORIGIN
}
