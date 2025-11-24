/**
 * Server-only authentication utilities
 * These functions use Clerk's server-side API and should ONLY be imported in:
 * - API routes (app/api/*)
 * - Server components
 * - Server actions
 * 
 * DO NOT import in client components - use @clerk/nextjs hooks instead
 */

import { auth as clerkAuth, currentUser } from '@clerk/nextjs/server'

/**
 * Get current user with full metadata (for API routes)
 * Returns null if not authenticated
 * Includes user data for both OAuth and email-based sign-ups
 */
export async function getCurrentUser() {
  const { userId } = await clerkAuth()
  if (!userId) return null
  
  // Fetch full user data from Clerk
  const user = await currentUser()
  if (!user) return { id: userId }
  
  // Extract user data for email-based and OAuth users
  const firstName = user.firstName || ''
  const lastName = user.lastName || ''
  const fullName = `${firstName} ${lastName}`.trim() || null
  const email = user.emailAddresses[0]?.emailAddress || null
  const username = user.username || null
  
  // Detect OAuth provider from external accounts
  const primaryProvider = user.externalAccounts?.[0]?.provider || null
  const isAppleUser = primaryProvider === 'oauth_apple'
  const isGitHubUser = primaryProvider === 'oauth_github'
  
  // Check if email is Apple's private relay email
  const isApplePrivateEmail = email?.includes('privaterelay.appleid.com') || false
  
  // Generate username from email if no username exists (for email-based sign-ups)
  // For Apple private emails, we'll handle this differently in profile-utils
  const generatedUsername = username || (email && !isApplePrivateEmail 
    ? email.split('@')[0].toLowerCase() 
    : null)
  
  // Generate display name from name or email (for email-based sign-ups)
  // For Apple: prefer actual name, fallback to a generic name if only private email exists
  let displayName = fullName || username
  if (!displayName && email) {
    if (isApplePrivateEmail) {
      // For Apple private email, use a more user-friendly fallback
      displayName = fullName || 'Apple User'
    } else {
      displayName = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1)
    }
  }
  
  return {
    id: userId,
    email,
    user_metadata: {
      full_name: fullName,
      name: fullName,
      preferred_username: username || generatedUsername,
      user_name: username || generatedUsername,
      login: username || generatedUsername,
      email: email,
      firstName: firstName || null,
      lastName: lastName || null,
      avatar_url: user.imageUrl || null,
      picture: user.imageUrl || null,
      // Add provider info for better handling of OAuth-specific edge cases
      provider: primaryProvider,
      is_apple_user: isAppleUser,
      is_github_user: isGitHubUser,
      is_apple_private_email: isApplePrivateEmail,
    }
  }
}

/**
 * Get current user ID (alias for compatibility)
 */
export async function getCurrentUserFromRequest() {
  return getCurrentUser()
}
