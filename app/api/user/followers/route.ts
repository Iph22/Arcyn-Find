import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/user/followers
 * Get the current user's followers and following lists
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const supabase = getSupabaseAdmin()

    // Get followers (people who follow me)
    const { data: followersData, error: followersError } = await supabase
      .from('user_follows')
      .select(`
        id,
        created_at,
        follower:user_profiles!user_follows_follower_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          bio
        )
      `)
      .eq('following_id', userId)
      .order('created_at', { ascending: false })

    if (followersError) throw followersError

    // Get following (people I follow)
    const { data: followingData, error: followingError } = await supabase
      .from('user_follows')
      .select(`
        id,
        created_at,
        following:user_profiles!user_follows_following_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          bio
        )
      `)
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })

    if (followingError) throw followingError

    // Get list of user IDs I'm following for the follow status check
    const followingIds = followingData?.map(f => {
      const following = Array.isArray(f.following) ? f.following[0] : f.following
      return following?.id
    }).filter(Boolean) || []

    // Transform data and add follow status
    const followers = followersData?.map(item => {
      const follower = Array.isArray(item.follower) ? item.follower[0] : item.follower
      return {
        id: item.id,
        user: {
          id: follower?.id || '',
          username: follower?.username || 'unknown',
          display_name: follower?.display_name || 'Unknown User',
          avatar_url: follower?.avatar_url || null,
          bio: follower?.bio || '',
        },
        isFollowing: followingIds.includes(follower?.id),
        created_at: item.created_at
      }
    }) || []

    const following = followingData?.map(item => {
      const followingUser = Array.isArray(item.following) ? item.following[0] : item.following
      return {
        id: item.id,
        user: {
          id: followingUser?.id || '',
          username: followingUser?.username || 'unknown',
          display_name: followingUser?.display_name || 'Unknown User',
          avatar_url: followingUser?.avatar_url || null,
          bio: followingUser?.bio || '',
        },
        isFollowing: true, // Always true for following list
        created_at: item.created_at
      }
    }) || []

    return createSuccessResponse({ followers, following })
  } catch (error) {
    console.error('Error fetching followers:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch followers',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

/**
 * POST /api/user/followers
 * Follow or unfollow a user
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const body = await request.json()
    const { targetUserId, action } = body

    if (!targetUserId || !action) {
      return createErrorResponse('Missing required fields', 400, ErrorCodes.VALIDATION_ERROR)
    }

    if (targetUserId === userId) {
      return createErrorResponse('Cannot follow yourself', 400, ErrorCodes.VALIDATION_ERROR)
    }

    const supabase = getSupabaseAdmin()

    if (action === 'follow') {
      // Add follow relationship
      const { error } = await supabase
        .from('user_follows')
        .insert({
          follower_id: userId,
          following_id: targetUserId,
          created_at: new Date().toISOString()
        })

      if (error) throw error
      return createSuccessResponse({ message: 'User followed successfully' })
    } else if (action === 'unfollow') {
      // Remove follow relationship
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', targetUserId)

      if (error) throw error
      return createSuccessResponse({ message: 'User unfollowed successfully' })
    } else {
      return createErrorResponse('Invalid action', 400, ErrorCodes.VALIDATION_ERROR)
    }
  } catch (error) {
    console.error('Error managing follow:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to manage follow',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
