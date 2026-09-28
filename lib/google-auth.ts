"use server"

import { cookies } from 'next/headers'
import { getSupabaseAdmin, OWN_PROFILE_COLUMNS } from './supabase'
import {
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    signSession,
    verifySession,
} from './session'

/**
 * Server-side database access, via the SERVICE ROLE key.
 *
 * This module used the ANON client, and it is imported only by server code
 * (no "use client" component imports it -- collection-card.tsx takes a type,
 * which is erased). Writing through the anon key meant the anon role needed
 * INSERT/UPDATE/DELETE on these tables, and because that key ships in the
 * public client bundle, anyone holding it had those rights directly.
 *
 * Measured on the new project 2026-09-28, before this change: anon held
 * DELETE, INSERT, SELECT, UPDATE and TRUNCATE on all 19 public tables, with
 * RLS off on 17 of them. Moving these calls to the service role is what lets
 * those grants be revoked -- see supabase/bootstrap/05_rls_and_grants.sql.
 *
 * Lazy rather than module-scope: getSupabaseAdmin() throws when the service
 * role key is absent, and this module is imported by 21 API routes. Failing
 * on first use beats failing at import time across all of them.
 */
let _admin: ReturnType<typeof getSupabaseAdmin> | null = null
const db = () => (_admin ??= getSupabaseAdmin())


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

/**
 * Get current session from cookies
 *
 * The cookie is HMAC-verified in lib/session.ts. Anything this deployment did
 * not sign -- including every cookie issued by the old unsigned scheme -- comes
 * back as null and reads as signed out.
 */
export async function getSession(): Promise<AuthSession> {
    try {
        const cookieStore = await cookies()
        const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

        const session = await verifySession(sessionCookie?.value)
        if (!session) {
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
 *
 * Throws if SESSION_SECRET is unset, so a misconfigured deployment fails at
 * sign-in instead of handing out cookies that nothing can verify.
 */
export async function createSession(user: GoogleUser): Promise<void> {
    const cookieStore = await cookies()

    const token = await signSession({
        // The Google access token is deliberately not carried in the cookie.
        // It was being stored there and never read back, which is a bearer
        // credential sitting in the browser for no benefit.
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            picture: user.picture,
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString()
    })

    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE_SECONDS,
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
 * Get current user from session (server-side, alias for compatibility)
 */
export async function getCurrentUserFromRequest(): Promise<GoogleUser | null> {
    return getCurrentUser()
}

/**
 * Get user profile from database
 */
export async function getUserProfile(userId?: string): Promise<UserProfile | null> {
    try {
        const targetUserId = userId || (await getCurrentUser())?.id
        if (!targetUserId) return null

        // Explicit list rather than `select('*')`. This is reached both for
        // the caller's own profile and for other users' (the userId argument
        // is optional), so it uses the wider set -- but an explicit one, so a
        // new column is a deliberate decision rather than an automatic leak.
        const { data, error } = await db()
            .from('user_profiles')
            .select(OWN_PROFILE_COLUMNS)
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
        const { data, error } = await db()
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
 *
 * `state` is supplied by the caller rather than built here: it has to be bound
 * to a nonce cookie set on the same response as the redirect, which only the
 * route handler can do. See app/api/auth/google/route.ts.
 */
export async function getGoogleAuthUrl(state: string, redirectUri: string): Promise<string> {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

    const params = new URLSearchParams({
        client_id: clientId || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        // `select_account`, not `consent`.
        //
        // This was `access_type=offline` + `prompt=consent`, which is the pair
        // you send when you need a refresh token. Nothing here needs one:
        // `refresh_token` occurs exactly once in the codebase, as a field on
        // the return type of exchangeCodeForTokens that no caller reads. The
        // callback uses the access token once to fetch userinfo and then mints
        // its own signed cookie.
        //
        // The cost of asking anyway was the sign-in experience. `consent` does
        // not imply `select_account`, so Google never offers the "choose an
        // account" screen — someone with a Google session gets the consent
        // page for whichever account happens to be active, and someone without
        // one is dropped on the bare identifier page, which leads with an
        // email box and a "Create account" button. That is what people were
        // reporting as being told to make a new Google account.
        //
        // `select_account` shows the accounts the browser already knows about,
        // which is the point when the complaint is "I already have one".
        prompt: 'select_account',
        state
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
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
                // Must be byte-identical to the redirect_uri sent at
                // authorisation, or Google answers redirect_uri_mismatch. Both
                // are derived from the request's own origin, and this handler
                // runs on the host Google was told to return to, so they agree.
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        })

        if (!response.ok) {
            // Google puts the actual reason in the body, and this used to
            // discard it and throw a generic message -- which is why a failing
            // sign-in gave no clue why. The body names one of a small set of
            // causes, and each has a different fix:
            //
            //   invalid_grant         code already used, or expired (~10 min),
            //                         or the clock is skewed
            //   redirect_uri_mismatch NEXT_PUBLIC_SITE_URL does not match the
            //                         URI registered in Google Cloud Console
            //   invalid_client        wrong GOOGLE_CLIENT_SECRET for this
            //                         client_id
            //
            // No secrets are logged: the response body echoes the error code and
            // description, not the credentials that were sent.
            const detail = await response.text().catch(() => '<unreadable body>')
            console.error(
                `[auth] Google token exchange failed: HTTP ${response.status} ${response.statusText} -- ${detail}`
            )
            console.error(
                `[auth] sent redirect_uri=${redirectUri} ` +
                `client_id=${(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '<unset>').slice(0, 24)}… ` +
                `client_secret=${process.env.GOOGLE_CLIENT_SECRET ? 'set' : '<UNSET>'}`
            )
            return null
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
        await db().from('user_preferences').delete().eq('user_id', user.id)
        await db().from('user_collections').delete().eq('user_id', user.id)
        await db().from('user_followers').delete().eq('follower_id', user.id)
        await db().from('user_followers').delete().eq('following_id', user.id)
        await db().from('user_profiles').delete().eq('id', user.id)

        // Delete session
        await deleteSession()

        return { success: true }
    } catch (error) {
        console.error('Error deleting account:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete account'
        return { success: false, error: errorMessage }
    }
}
