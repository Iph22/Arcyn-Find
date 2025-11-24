import { getSupabaseAdmin, supabase } from './supabase'
import { getCurrentUser } from './auth'

export interface UserProfile {
  id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  user_role?: string | null
  purpose?: string | null
  experience_level?: string | null
  categories?: string[] | null
  features?: string[] | null
  onboarding_completed: boolean
  instructions_seen: boolean
  onboarding_completed_at?: string | null
  preferences?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/**
 * Get user profile from database
 * Works on both client and server
 * Single source of truth for profile data
 */
export async function getProfileFromDB(userId: string): Promise<UserProfile | null> {
  try {
    // Use admin client on server, regular client on browser
    const client = typeof window === 'undefined' 
      ? getSupabaseAdmin() 
      : supabase
    
    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found
        return null
      }
      throw error
    }

    return data as UserProfile | null
  } catch (error) {
    console.error('Error fetching profile from DB:', error)
    return null
  }
}

/**
 * Ensure user profile exists
 * Creates profile if it doesn't exist, updates if it does
 * Works on both client and server
 */
export async function ensureProfile(user: { id: string; user_metadata?: Record<string, unknown> }): Promise<UserProfile> {
  // On client, use API endpoint
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/auth/ensure-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to ensure profile')
      }
      
      // Fetch the profile after ensuring it exists
      const profile = await getProfileFromDB(user.id)
      if (!profile) {
        throw new Error('Profile was not created')
      }
      return profile
    } catch (error) {
      console.error('Error ensuring profile via API:', error)
      throw error
    }
  }
  
  // On server, use admin client directly
  const supabaseAdmin = getSupabaseAdmin()
  const metadata = user.user_metadata || {}
  
  // Check if profile exists
  const existing = await getProfileFromDB(user.id)
  
  if (existing) {
    // Update with latest OAuth metadata
    const updateData: {
      display_name?: string | null
      avatar_url?: string | null
    } = {}
    
    const displayName = metadata.full_name || metadata.name || metadata.preferred_username || metadata.login
    if (displayName && typeof displayName === 'string') {
      updateData.display_name = displayName
    }
    
    const avatarUrl = metadata.avatar_url || metadata.picture
    if (avatarUrl && typeof avatarUrl === 'string') {
      updateData.avatar_url = avatarUrl
    }
    
    if (Object.keys(updateData).length > 0) {
      await supabaseAdmin
        .from('user_profiles')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }
    
    return (await getProfileFromDB(user.id))!
  }
  
  // Create new profile
  const username = metadata.preferred_username || metadata.user_name || metadata.login
  const usernameFromName = metadata.name && typeof metadata.name === 'string' 
    ? metadata.name.toLowerCase().replace(/\s+/g, '') 
    : null
  
  const displayName = metadata.full_name || metadata.name || metadata.preferred_username || metadata.login
  const avatarUrl = metadata.avatar_url || metadata.picture
  
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      id: user.id,
      username: (username && typeof username === 'string' ? username : usernameFromName) || null,
      display_name: (displayName && typeof displayName === 'string' ? displayName : null) || null,
      avatar_url: (avatarUrl && typeof avatarUrl === 'string' ? avatarUrl : null) || null,
      onboarding_completed: false,
      instructions_seen: false,
    })
    .select()
    .single()

  if (error) throw error
  return data as UserProfile
}

/**
 * Update profile in database
 */
export async function updateProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error updating profile:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update profile',
    }
  }
}

