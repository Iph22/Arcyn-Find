"use server"

/**
 * Backward compatibility layer for clerk-auth
 * Redirects everything to Google OAuth
 */

import {
  getCurrentUser as getBaseUser,
  getUserProfile,
  upsertUserProfile,
  signOut,
  deleteAccount,
  type UserProfile,
} from './google-auth'

export {
  getUserProfile,
  upsertUserProfile,
  signOut,
  deleteAccount,
  type UserProfile,
}

export async function getCurrentUser() {
  return getBaseUser()
}

export async function getCurrentUserFromRequest() {
  return getBaseUser()
}
