import { NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/google-auth'
import { googleCallbackUri } from '@/lib/oauth-redirect'
import {
    OAUTH_STATE_COOKIE_NAME,
    OAUTH_STATE_MAX_AGE_SECONDS,
    createOAuthNonce,
    encodeOAuthState,
    safeRedirectPath,
} from '@/lib/session'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)

        // `?redirect=` is caller-supplied and ends up in `new URL(path, base)`
        // in the callback, where an absolute or protocol-relative value would
        // leave the site.
        const redirectPath = safeRedirectPath(searchParams.get('redirect'))

        // The nonce goes two places: into the OAuth `state` that round-trips
        // through Google, and into an httpOnly cookie the callback compares it
        // against. An attacker can forge the first but not the second, which is
        // what stops a login-CSRF that lands the victim in the attacker's account.
        const nonce = createOAuthNonce()
        const state = encodeOAuthState({ nonce, redirectPath })

        // Derived from this request, not from NEXT_PUBLIC_SITE_URL: that is a
        // single value shared by the development, preview and production
        // targets, so a preview told Google to return to the production
        // domain, where the state cookie set a moment ago does not exist.
        const authUrl = await getGoogleAuthUrl(state, googleCallbackUri(request))

        const response = NextResponse.redirect(authUrl)

        response.cookies.set(OAUTH_STATE_COOKIE_NAME, nonce, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            // `lax` still sends the cookie on Google's top-level redirect back.
            sameSite: 'lax',
            maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
            path: '/',
        })

        return response
    } catch (error) {
        console.error('Error initiating Google OAuth:', error)
        return NextResponse.redirect(new URL('/sign-in?error=oauth_error', request.url))
    }
}
