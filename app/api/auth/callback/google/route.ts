import { NextResponse } from 'next/server'
import {
    exchangeCodeForTokens,
    getGoogleUserInfo,
    createSession,
    upsertUserProfile
} from '@/lib/google-auth'

export async function GET(request: Request) {
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

        // Parse redirect path from state
        let redirectPath = '/home'
        if (state) {
            try {
                const stateData = JSON.parse(atob(state))
                redirectPath = stateData.redirectPath || '/home'
            } catch (e) {
                console.error('Error parsing state:', e)
            }
        }

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

        // Check if user needs onboarding (new user)
        const redirectUrl = new URL(redirectPath, request.url)

        // Use 302 redirect for better mobile compatibility
        const response = NextResponse.redirect(redirectUrl, 302)

        return response
    } catch (error) {
        console.error('Error in Google OAuth callback:', error)
        return NextResponse.redirect(new URL('/sign-in?error=callback_error', request.url))
    }
}
