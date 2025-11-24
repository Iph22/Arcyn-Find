/**
 * Server-only authentication utilities
 * These functions use Clerk's server-side API and should ONLY be imported in:
 * - API routes (app/api/*)
 * - Server components
 * - Server actions
 * 
 * DO NOT import in client components - use @clerk/nextjs hooks instead
 */

import { auth as clerkAuth } from '@clerk/nextjs/server'

/**
 * Get current user ID from request (for API routes)
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const { userId } = await clerkAuth()
  if (!userId) return null
  
  return { id: userId }
}

/**
 * Get current user ID (alias for compatibility)
 */
export async function getCurrentUserFromRequest() {
  return getCurrentUser()
}
