"use server"

import { cookies } from 'next/headers'
import { supabase } from './supabase'

export interface GoogleUser {
    id: string
    email: string
    name: string
    picture: string
    accessToken?: string
}

export interface AuthSession {
    user: GoogleUser | null
    isAuthenticated: boolean
}

export interface UserProfile {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
    banner_url?: string
    bio?: string
    email?: string
    created_at: string
    updated_at: string
}

const SESSION_COOKIE_NAME = 'arcyn_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/**
 * Get current session from cookies
 */
export async function getSession(): Promise<AuthSession> {
    try {
        const cookieStore = await cookies()
        const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

        if (!sessionCookie?.value) {
            return { user: null, isAuthenticated: false }
        }

        // Parse and validate session
        const session = JSON.parse(atob(sessionCookie.value))

        // Check if session is expired
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
            return { user: null, isAuthenticated: false }
        }

        return {
            user: session.user,
            isAuthenticated: true
        }
    } catch (error) {
        console.error('Error getting session:', error)
        return { user: null, isAuthenticated: false }
    }
}

/**
 * Create a new session
 */
export async function createSession(user: GoogleUser): Promise<void> {
    const cookieStore = await cookies()

    const session = {
        user,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString()
    }

    cookieStore.set(SESSION_COOKIE_NAME, btoa(JSON.stringify(session)), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE,
        path: '/'
    })
}

/**
 * Delete the session (Sign out)
 */
export async function deleteSession(): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Alias for deleteSession
 */
export async function signOut(): Promise<void> {
    return deleteSession()
}

/**
 * Get current user from session (server-side)
 */
export async function getCurrentUser(): Promise<GoogleUser | null> {
    const session = await getSession()
    return session.user
}

/**
 * Get user profile from database
 */
export async function getUserProfile(userId?: string): Promise<UserProfile | null> {
    try {
        const targetUserId = userId || (await getCurrentUser())?.id
        if (!targetUserId) return null

        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', targetUserId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return null
            }
            throw error
        }

        return data as UserProfile
    } catch (error) {
        console.error('Error fetching user profile:', error)
        return null
    }
}

/**
 * Create or update user profile in Supabase
 */
export async function upsertUserProfile(profile: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
    banner_url?: string
    bio?: string
    email?: string
}): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .upsert({
                ...profile,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id',
            })
            .select()
            .single()

        if (error) throw error

        return { success: true, profile: data as UserProfile }
    } catch (error) {
        console.error('Error upserting user profile:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to update profile'
        return { success: false, error: errorMessage }
    }
}

/**
 * Generate Google OAuth URL
 */
export async function getGoogleAuthUrl(redirectPath: string = '/home'): Promise<string> {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback/google`

    const params = new URLSearchParams({
        client_id: clientId || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
        state: btoa(JSON.stringify({ redirectPath }))
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
    access_token: string
    id_token: string
    refresh_token?: string
} | null> {
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
                client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
                redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback/google`,
                grant_type: 'authorization_code',
            }),
        })

        if (!response.ok) {
            throw new Error('Failed to exchange code for tokens')
        }

        return response.json()
    } catch (error) {
        console.error('Error exchanging code for tokens:', error)
        return null
    }
}

/**
 * Get user info from Google
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUser | null> {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        if (!response.ok) {
            throw new Error('Failed to get user info')
        }

        const data = await response.json()

        return {
            id: data.sub,
            email: data.email,
            name: data.name,
            picture: data.picture,
            accessToken
        }
    } catch (error) {
        console.error('Error getting user info:', error)
        return null
    }
}

/**
 * Delete account and all associated data
 */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return { success: false, error: 'User not authenticated' }
        }

        // Delete user data from database
        await supabase.from('user_preferences').delete().eq('user_id', user.id)
        await supabase.from('user_collections').delete().eq('user_id', user.id)
        await supabase.from('user_followers').delete().eq('follower_id', user.id)
        await supabase.from('user_followers').delete().eq('following_id', user.id)
        await supabase.from('user_profiles').delete().eq('id', user.id)

        // Delete session
        await deleteSession()

        return { success: true }
    } catch (error) {
        console.error('Error deleting account:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete account'
        return { success: false, error: errorMessage }
    }
}
