"use server"

/**
 * Server-only authentication utilities
 * These functions use custom Google OAuth and should ONLY be imported in:
 * - API routes (app/api/*)
 * - Server components
 * - Server actions
 * 
 * DO NOT import in client components - use @/contexts/auth-context hooks instead
 */

import { getCurrentUser as getGoogleAuthUser } from '@/lib/google-auth'

/**
 * Get current user with full metadata (for API routes)
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  return getGoogleAuthUser()
}

/**
 * Get current user ID (alias for compatibility)
 */
export async function getCurrentUserFromRequest() {
  return getCurrentUser()
}
