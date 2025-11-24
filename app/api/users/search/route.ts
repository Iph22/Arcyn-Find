import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/users/search
 * Search for users by username or display name
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    
    if (!query || query.trim().length < 2) {
      return createErrorResponse('Search query must be at least 2 characters', 400, ErrorCodes.VALIDATION_ERROR)
    }

    const supabase = getSupabaseAdmin()
    
    // Search users by username or display_name
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, bio')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq('id', userId) // Exclude current user from results
      .limit(20)

    if (error) throw error

    // Check follow status for each user
    const { data: followData } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)

    const followingIds = new Set(followData?.map(f => f.following_id) || [])

    const usersWithFollowStatus = users?.map(user => ({
      ...user,
      isFollowing: followingIds.has(user.id)
    })) || []

    return createSuccessResponse({ users: usersWithFollowStatus })
  } catch (error) {
    console.error('Error searching users:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to search users',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
