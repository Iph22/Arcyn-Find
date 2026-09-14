import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
    exchangeCodeForTokens,
    getGoogleUserInfo,
    createSession,
    upsertUserProfile,
    getUserProfile
} from '@/lib/google-auth'
import {
    OAUTH_STATE_COOKIE_NAME,
    decodeOAuthState,
    nonceMatches,
} from '@/lib/session'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')

        // Handle OAuth errors
        if (error) {
            console.error('OAuth error:', error)
            return NextResponse.redirect(new URL('/sign-in?error=oauth_denied', request.url))
        }

        if (!code) {
            return NextResponse.redirect(new URL('/sign-in?error=no_code', request.url))
        }

        // Verify the OAuth state before spending a token exchange on it.
        //
        // `state` previously carried only a base64 redirect path and was never
        // checked, so it was decoration rather than a CSRF token -- an attacker
        // could hand a victim a crafted callback URL and sign them into the
        // attacker's Google account. The nonce inside it must now match the
        // httpOnly cookie set when this flow started.
        const oauthState = decodeOAuthState(state)
        const expectedNonce = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value

        if (!oauthState || !nonceMatches(oauthState.nonce, expectedNonce)) {
            console.error('OAuth state mismatch: rejecting callback')
            return NextResponse.redirect(new URL('/sign-in?error=invalid_state', request.url))
        }

        // decodeOAuthState re-sanitises this; it round-tripped through the browser.
        const redirectPath = oauthState.redirectPath

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code)
        if (!tokens) {
            return NextResponse.redirect(new URL('/sign-in?error=token_exchange_failed', request.url))
        }

        // Get user info from Google
        const googleUser = await getGoogleUserInfo(tokens.access_token)
        if (!googleUser) {
            return NextResponse.redirect(new URL('/sign-in?error=user_info_failed', request.url))
        }

        // Check if user exists before creating session (to determine if new user)
        const existingProfile = await getUserProfile(googleUser.id)
        const isNewUser = !existingProfile

        // Create session
        await createSession(googleUser)

        // Create or update user profile in database
        await upsertUserProfile({
            id: googleUser.id,
            display_name: googleUser.name,
            avatar_url: googleUser.picture,
            email: googleUser.email,
            username: googleUser.email.split('@')[0],
        })

        // Determine redirect URL
        let finalRedirectPath = redirectPath
        if (isNewUser) {
            finalRedirectPath = '/onboarding'
        }

        const redirectUrl = new URL(finalRedirectPath, request.url)

        // Use 302 redirect for better mobile compatibility
        const response = NextResponse.redirect(redirectUrl, 302)

        // The nonce is single-use.
        response.cookies.delete(OAUTH_STATE_COOKIE_NAME)

        return response
    } catch (error) {
        // Reaches here if SESSION_SECRET is unset: createSession throws rather
        // than issue a cookie nothing can verify.
        console.error('Error in Google OAuth callback:', error)
        return NextResponse.redirect(new URL('/sign-in?error=callback_error', request.url))
    }
}
