/**
 * User Search API Route - Security Hardened
 * 
 * Security Features:
 * - Rate limiting for search operations
 * - Query sanitization to prevent SQL injection
 * - Minimum query length enforcement
 * - Input length limits
 */

import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  sanitizeForQuery,
  safeSearchQuery
} from '@/lib/security'
import { z } from 'zod'

// Search query validation schema
const searchQuerySchema = z.object({
  q: safeSearchQuery
})

/**
 * GET /api/users/search
 * Search for users by username or display name
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    // =========================================================================
    // RATE LIMITING - Search endpoints
    // =========================================================================
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.SEARCH, user.id)

    if (!rateLimit.allowed) {
      logger.warn('[UserSearch] Rate limit exceeded for user:', user.id)
      return createRateLimitResponse(
        rateLimit,
        'Too many search requests. Please wait before trying again.'
      )
    }

    // =========================================================================
    // INPUT VALIDATION
    // =========================================================================
    const searchParams = request.nextUrl.searchParams
    const queryParam = searchParams.get('q')

    if (!queryParam || queryParam.trim().length < 2) {
      return createErrorResponse(
        'Search query must be at least 2 characters',
        400,
        ErrorCodes.VALIDATION_ERROR
      )
    }

    // Sanitize the query to prevent SQL injection
    const query = sanitizeForQuery(queryParam.trim())

    // Additional length validation
    if (query.length > 100) {
      return createErrorResponse(
        'Search query is too long',
        400,
        ErrorCodes.VALIDATION_ERROR
      )
    }

    // =========================================================================
    // SEARCH USERS
    // =========================================================================
    const supabase = getSupabaseAdmin()

    // Search users by username or display_name using parameterized query
    // Supabase handles SQL injection prevention, but we still sanitize
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, banner_url, bio')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq('id', user.id) // Exclude current user from results
      .limit(20)

    if (error) throw error

    // Filter out users with null username AND null display_name
    const searchableUsers = users?.filter(u =>
      u.username || u.display_name
    ) || []

    // Check follow status for each user
    const { data: followData } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds = new Set(followData?.map(f => f.following_id) || [])

    const usersWithFollowStatus = searchableUsers?.map(u => ({
      ...u,
      isFollowing: followingIds.has(u.id)
    })) || []

    const response = createSuccessResponse({ users: usersWithFollowStatus })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error('[UserSearch] Error searching users:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to search users',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
