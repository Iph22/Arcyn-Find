import { getProfileFromDB } from './profile-utils'

/**
 * Get the next page a user should be on based on their profile
 * Linear flow: onboarding → instructions → home
 */
export async function getNextPageForUser(userId: string): Promise<string> {
  const profile = await getProfileFromDB(userId)
  
  // Linear flow: onboarding → instructions → home
  if (!profile || !profile.onboarding_completed) {
    return '/onboarding'
  }
  
  if (!profile.instructions_seen) {
    return '/instructions'
  }
  
  return '/home'
}

/**
 * Check if user should be redirected from current page
 * Returns the target page if redirect is needed, null otherwise
 */
export async function shouldRedirect(userId: string, currentPath: string): Promise<string | null> {
  const nextPage = await getNextPageForUser(userId)
  
  // Normalize paths (remove query params, trailing slashes)
  const normalizePath = (path: string) => {
    return path.split('?')[0].split('#')[0].replace(/\/$/, '') || '/'
  }
  
  const normalizedCurrent = normalizePath(currentPath)
  const normalizedNext = normalizePath(nextPage)
  
  if (normalizedCurrent !== normalizedNext) {
    return nextPage
  }
  
  return null
}

