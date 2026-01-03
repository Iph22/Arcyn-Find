"use server"

/**
 * Backward compatibility layer for clerk-auth
 * Redirects everything to Google OAuth
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
