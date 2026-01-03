"use server"

/**
 * Backward compatibility layer for authentication
 * Bridges the gap between legacy Clerk-style calls and new Google OAuth
 */

export {
  getCurrentUser,
  getCurrentUserFromRequest,
  getUserProfile,
  upsertUserProfile,
  signOut,
  deleteAccount,
  type UserProfile,
} from './google-auth'

// Compatibility stubs for functions that no longer apply in the same way
export async function signIn() {
  return { success: false, error: 'Use AuthContext or /api/auth/google' }
}

export async function signUp() {
  return { success: false, error: 'Use AuthContext or /api/auth/google' }
}

export async function signInWithProvider() {
  return { success: false, error: 'Use AuthContext or /api/auth/google' }
}
