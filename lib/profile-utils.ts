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
    // Update with latest metadata (from OAuth or email)
    const updateData: {
      display_name?: string | null
      avatar_url?: string | null
      username?: string | null
    } = {}
    
    // Detect if this is an Apple user (Apple only provides name/email on first sign-up)
    const isAppleUser = metadata.is_apple_user === true
    const isApplePrivateEmail = metadata.is_apple_private_email === true
    const hasExistingDisplayName = existing.display_name && existing.display_name !== 'Apple User'
    
    // Extract display name from metadata
    const displayName = metadata.full_name || metadata.name || metadata.preferred_username || metadata.login
    
    // For Apple users: preserve existing name if new data is missing (Apple doesn't provide it on subsequent sign-ins)
    if (isAppleUser) {
      if (displayName && typeof displayName === 'string' && displayName !== 'Apple User') {
        // We have real name data - update it
        updateData.display_name = displayName
      } else if (hasExistingDisplayName) {
        // Apple user with existing name but no new data - preserve existing
        // Don't update, keep what we have
      } else if (displayName && typeof displayName === 'string') {
        // First time or fallback - use what we have
        updateData.display_name = displayName
      }
    } else {
      // Non-Apple users: normal update logic
      if (displayName && typeof displayName === 'string') {
        updateData.display_name = displayName
      }
    }
    
    // Generate display_name from email if missing and no OAuth data (for non-Apple or first-time Apple users)
    if (!updateData.display_name && metadata.email && typeof metadata.email === 'string') {
      if (isApplePrivateEmail && hasExistingDisplayName) {
        // Don't overwrite existing name with private email
        // Keep existing display_name
      } else {
        const emailName = metadata.email.split('@')[0]
        updateData.display_name = emailName.charAt(0).toUpperCase() + emailName.slice(1)
      }
    }
    
    const avatarUrl = metadata.avatar_url || metadata.picture
    if (avatarUrl && typeof avatarUrl === 'string') {
      updateData.avatar_url = avatarUrl
    }
    
    // Update username if not set and we have one from metadata
    const username = metadata.preferred_username || metadata.user_name || metadata.login
    if (username && typeof username === 'string' && !existing.username) {
      updateData.username = username
    }
    
    // Generate username from email if missing and no OAuth data
    // For Apple private emails, generate a more user-friendly username
    if (!updateData.username && !existing.username && metadata.email && typeof metadata.email === 'string') {
      if (isApplePrivateEmail) {
        // For Apple private email, use a combination approach
        const emailPrefix = metadata.email.split('@')[0]
        // Try to use existing display_name if available, otherwise use email prefix
        updateData.username = (existing.display_name && existing.display_name !== 'Apple User'
          ? existing.display_name.toLowerCase().replace(/\s+/g, '')
          : emailPrefix.toLowerCase())
      } else {
        updateData.username = metadata.email.split('@')[0].toLowerCase()
      }
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
  // Extract username from various sources (OAuth first, then email)
  const isAppleUser = metadata.is_apple_user === true
  const isApplePrivateEmail = metadata.is_apple_private_email === true
  
  const username = metadata.preferred_username || metadata.user_name || metadata.login
  const usernameFromName = metadata.name && typeof metadata.name === 'string' 
    ? metadata.name.toLowerCase().replace(/\s+/g, '') 
    : null
  const usernameFromEmail = metadata.email && typeof metadata.email === 'string' && !isApplePrivateEmail
    ? metadata.email.split('@')[0].toLowerCase()
    : null
  
  // Use first available username source
  // For Apple private email, prefer name-based username
  const finalUsername = (username && typeof username === 'string' ? username : null) 
    || usernameFromName 
    || usernameFromEmail
    || (isAppleUser ? 'appleuser' : null) // Fallback for Apple users
  
  // Extract display name (OAuth first, then email)
  const displayName = metadata.full_name || metadata.name || metadata.preferred_username || metadata.login
  const displayNameFromEmail = metadata.email && typeof metadata.email === 'string' && !isApplePrivateEmail
    ? metadata.email.split('@')[0].charAt(0).toUpperCase() + metadata.email.split('@')[0].slice(1)
    : null
  
  // Use first available display name source
  // For Apple: prefer actual name, fallback to generic if only private email
  const finalDisplayName = (displayName && typeof displayName === 'string' ? displayName : null)
    || displayNameFromEmail
    || (isAppleUser ? 'Apple User' : null) // Fallback for Apple users with private email
  
  const avatarUrl = metadata.avatar_url || metadata.picture
  
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      id: user.id,
      username: finalUsername || null,
      display_name: finalDisplayName || null,
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

