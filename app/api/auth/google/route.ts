import { NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/google-auth'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const redirectPath = searchParams.get('redirect') || '/home'

        const authUrl = await getGoogleAuthUrl(redirectPath)

        return NextResponse.redirect(authUrl)
    } catch (error) {
        console.error('Error initiating Google OAuth:', error)
        return NextResponse.redirect(new URL('/sign-in?error=oauth_error', request.url))
    }
}
