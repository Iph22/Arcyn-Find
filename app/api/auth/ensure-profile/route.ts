import { NextRequest } from 'next/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/auth-server'
import { ensureProfile, getProfileFromDB } from '@/lib/profile-utils'

/**
 * POST /api/auth/ensure-profile
 * Ensures user profile exists after OAuth authentication
 * Simplified to use profile-utils
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    // Ensure profile exists (creates if new, updates if existing)
    const profile = await ensureProfile(user)
    
    return createSuccessResponse({
      isNewUser: !profile.onboarding_completed && !profile.instructions_seen,
      onboarding_completed: profile.onboarding_completed || false,
      instructions_seen: profile.instructions_seen || false,
    })
  } catch (error) {
    logger.error('Error ensuring user profile:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to ensure profile',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

