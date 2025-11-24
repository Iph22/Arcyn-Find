// Re-export Clerk authentication functions for backward compatibility
export {
  getCurrentUser,
  getCurrentUserFromRequest,
  getUserProfile,
  upsertUserProfile,
  signIn,
  signUp,
  signOut,
  signInWithProvider,
  deleteAccount,
  type UserProfile,
} from './clerk-auth'

