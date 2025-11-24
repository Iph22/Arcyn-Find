import { getCurrentUser } from './auth'
import { getProfileFromDB, type UserProfile } from './profile-utils'
import { getNextPageForUser } from './redirect-utils'

export interface AuthState {
  isAuthenticated: boolean
  user: { id: string; email?: string } | null
  profile: UserProfile | null
  nextPage: string | null
}

/**
 * Get complete auth state from database
 * This is the single source of truth for authentication state
 */
export async function getAuthState(): Promise<AuthState> {
  const user = await getCurrentUser()
  
  if (!user) {
    return {
      isAuthenticated: false,
      user: null,
      profile: null,
      nextPage: null,
    }
  }
  
  // Always fetch fresh from database (single source of truth)
  const profile = await getProfileFromDB(user.id)
  const nextPage = profile ? await getNextPageForUser(user.id) : '/onboarding'
  
  return {
    isAuthenticated: true,
    user: {
      id: user.id,
      email: user.email || undefined,
    },
    profile,
    nextPage,
  }
}

/**
 * Check if user is authenticated
 * Quick check without fetching full profile
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

