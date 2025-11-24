import { currentUser, auth as clerkAuth } from '@clerk/nextjs/server'

export interface UserProfile {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  banner_url?: string
  bio?: string
  created_at: string
  updated_at: string
}

/**
 * Get current user (client-side)
 * Compatible replacement for Supabase getCurrentUser
 */
export async function getCurrentUser() {
  try {
    const user = await currentUser()
    if (!user) return null
    
    // Convert Clerk user to a format compatible with existing code
    return {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || null,
      user_metadata: {
        full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
        preferred_username: user.username || null,
        avatar_url: user.imageUrl || null,
      }
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Get current user from API route (server-side)
 * Compatible replacement for getCurrentUserFromRequest
 */
export async function getCurrentUserFromRequest() {
  try {
    const { userId } = await clerkAuth()
    if (!userId) return null
    
    const user = await currentUser()
    if (!user) return null
    
    return {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || null,
      user_metadata: {
        full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
        preferred_username: user.username || null,
        avatar_url: user.imageUrl || null,
      }
    }
  } catch (error) {
    console.error('Error getting user from request:', error)
    return null
  }
}

/**
 * Get user profile from Supabase (keeping this for database operations)
 */
export async function getUserProfile(userId?: string): Promise<UserProfile | null> {
  try {
    const targetUserId = userId || (await getCurrentUser())?.id
    if (!targetUserId) return null

    const { supabase } = await import('./supabase')
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
  username?: string
  display_name?: string
  avatar_url?: string
  banner_url?: string
  bio?: string
}): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'You must be logged in' }
    }

    const { supabase } = await import('./supabase')
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
 * Sign in - Redirect to Clerk sign-in
 * For compatibility with existing code
 */
export async function signIn(): Promise<{ success: boolean; error?: string }> {
  // Clerk handles auth through their components and redirects
  // This is a placeholder for compatibility
  return { success: false, error: 'Please use Clerk SignIn component' }
}

/**
 * Sign up - Redirect to Clerk sign-up
 * For compatibility with existing code
 */
export async function signUp(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Please use Clerk SignUp component' }
}

/**
 * Sign out - Use Clerk's sign out
 * For compatibility with existing code
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    // This should be handled by Clerk's SignOutButton or useClerk hook
    return { success: true }
  } catch (error) {
    console.error('Error signing out:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign out'
    return { success: false, error: errorMessage }
  }
}

/**
 * OAuth sign in - Handled by Clerk
 * For compatibility with existing code
 */
export async function signInWithProvider(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Please use Clerk OAuth buttons' }
}

/**
 * Delete account - Use Clerk's user deletion
 */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Call API route to delete account
    const response = await fetch('/api/user/delete-account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete account')
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting account:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete account'
    return { success: false, error: errorMessage }
  }
}
