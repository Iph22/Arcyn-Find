/**
 * Where Google should send the user back to.
 *
 * WHY THIS IS NOT JUST `NEXT_PUBLIC_SITE_URL`
 *
 * It was, and that is what made signing in on a preview deployment fail with
 * `?error=invalid_state`. `NEXT_PUBLIC_SITE_URL` is one value in Vercel with
 * all three targets (development, preview, production) pointing at it, so a
 * preview sent Google a redirect_uri on the production domain. The sequence:
 *
 *   1. /api/auth/google runs on the preview and sets the state cookie there
 *   2. Google is told to return to https://arcynfind.com/...
 *   3. the callback runs on production, where that cookie does not exist
 *   4. the nonce cannot match, so the callback rejects its own flow
 *
 * The user lands on `arcynfind.com/sign-in?error=invalid_state` having started
 * somewhere else entirely, which is why the error reads as a CSRF failure when
 * nothing hostile happened. The cookie is fine; it was simply left on another
 * origin.
 *
 * Deriving the origin from the request instead means both halves of the flow
 * agree on every deployment, because each derives it from the host it is
 * actually running on. Google requires the redirect_uri at token exchange to
 * equal the one sent at authorisation; the callback runs on exactly the host
 * Google was told to return to, so the two strings match by construction.
 *
 * ON HOST HEADERS AND TRUST
 *
 * The host is attacker-controllable in principle, so this allowlists rather
 * than echoing it. The real protection is Google's own: a redirect_uri that is
 * not registered in the Cloud Console is refused before any code is issued, so
 * an injected host cannot receive one. The allowlist is the second lock, and
 * it is what keeps a mistake here from depending on that first one.
 */

import { PRODUCTION_ORIGIN } from './seo/site'

const CALLBACK_PATH = '/api/auth/callback/google'

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
 * The redirect_uri for this request, or the production one when the request's
 * own origin is not allowed.
 *
 * Falling back rather than throwing keeps a misconfigured host from taking
 * sign-in down completely: it behaves exactly as it did before this module
 * existed, which is a working flow on production.
 */
export function googleCallbackUri(request: Request): string {
  const origin = requestOrigin(request)

  if (origin && isAllowedOAuthOrigin(origin)) {
    return `${origin}${CALLBACK_PATH}`
  }

  if (origin) {
    console.warn(
      `[auth] origin ${origin} is not an allowed OAuth origin; ` +
        `falling back to the configured site URL. Sign-in started here will ` +
        `finish on another domain and fail its state check.`
    )
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL
  const base = configured && /^https?:\/\//i.test(configured) ? configured : PRODUCTION_ORIGIN
  return `${base.replace(/\/+$/, '')}${CALLBACK_PATH}`
}
