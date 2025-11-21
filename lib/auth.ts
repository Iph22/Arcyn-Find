import { supabase } from './supabase'

export interface UserProfile {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
  created_at: string
  updated_at: string
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      // Don't log "Auth session missing" as an error - it's expected when user isn't logged in
      if (error.message?.includes('session') || error.message?.includes('JWT')) {
        return null // User is not authenticated, return null gracefully
      }
      throw error
    }
    return user
  } catch (error) {
    // Only log unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (!errorMessage.includes('session') && !errorMessage.includes('JWT')) {
      console.error('Error getting current user:', error)
    }
    return null
  }
}

/**
 * Get user profile
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
      if (error.code === 'PGRST116') { // No rows returned
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
 * Create or update user profile
 */
export async function upsertUserProfile(profile: {
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
}): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'You must be logged in' }
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        ...profile,
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
 * Sign up with email
 */
export async function signUp(email: string, password: string, metadata?: {
  username?: string
  display_name?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })

    if (error) throw error

    // Create user profile
    if (data.user) {
      await upsertUserProfile({
        username: metadata?.username,
        display_name: metadata?.display_name,
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Error signing up:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign up'
    return { success: false, error: errorMessage }
  }
}

/**
 * Sign in with email
 */
export async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error signing in:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign in'
    return { success: false, error: errorMessage }
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error signing out:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign out'
    return { success: false, error: errorMessage }
  }
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithProvider(provider: 'google' | 'github'): Promise<{ success: boolean; error?: string }> {
  try {
    // Use production URL for OAuth redirect, or fallback to current origin
    // Always use production URL in production, current origin in development
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    const redirectUrl = typeof window !== 'undefined' 
      ? (isProduction 
          ? (process.env.NEXT_PUBLIC_SITE_URL || 'https://arcyn-find.vercel.app')
          : window.location.origin)
      : 'https://arcyn-find.vercel.app'
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${redirectUrl}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) throw error

    // OAuth redirect will happen, so we return success
    // The actual sign-in happens in the callback route
    return { success: true }
  } catch (error) {
    console.error('Error signing in with provider:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign in'
    return { success: false, error: errorMessage }
  }
}

/**
 * Reset password
 */
export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get redirect URL - use production URL in production, current origin in development
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    const redirectUrl = typeof window !== 'undefined'
      ? (isProduction
          ? (process.env.NEXT_PUBLIC_SITE_URL || 'https://arcyn-find.vercel.app')
          : window.location.origin)
      : 'https://arcyn-find.vercel.app'
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectUrl}/auth/reset-password`,
    })

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error resetting password:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to reset password'
    return { success: false, error: errorMessage }
  }
}

