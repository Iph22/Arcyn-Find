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

import { appOrigin, isAllowedOAuthOrigin } from './request-origin'

export { isAllowedOAuthOrigin }

const CALLBACK_PATH = '/api/auth/callback/google'

/**
 * The redirect_uri for this request, or the production one when the request's
 * own origin is not allowed.
 *
 * Falling back rather than throwing keeps a misconfigured host from taking
 * sign-in down completely: it behaves exactly as it did before this module
 * existed, which is a working flow on production.
 */
export function googleCallbackUri(request: Request): string {
  return `${appOrigin(request)}${CALLBACK_PATH}`
}
