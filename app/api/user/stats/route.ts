import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * GET /api/user/stats
 * Get the current user's statistics (followers, following, reviews, saved tools)
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user from Google OAuth
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const supabase = getSupabaseAdmin()

    // Get followers count
    const { count: followersCount } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', user.id)

    // Get following count
    const { count: followingCount } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', user.id)

    // Get reviews count
    const { count: reviewsCount } = await supabase
      .from('tool_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Get saved tools (favorites) count
    const { count: savedToolsCount } = await supabase
      .from('user_favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Get collections count
    const { count: collectionsCount } = await supabase
      .from('collections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return createSuccessResponse({
      stats: {
        followers: followersCount || 0,
        following: followingCount || 0,
        reviews: reviewsCount || 0,
        savedTools: savedToolsCount || 0,
        collections: collectionsCount || 0,
      }
    })
  } catch (error) {
    logger.error('Error fetching user stats:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch stats',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
