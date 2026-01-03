import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * GET /api/user/activity
 * Get the current user's recent activity
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

    // Get user activities
    const { data, error } = await supabase
      .from('user_activities')
      .select(`
        id,
        activity_type,
        created_at,
        tool:ai_tools (
          id,
          name
        ),
        review:tool_reviews (
          id,
          title
        ),
        collection:collections (
          id,
          name
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      throw error
    }

    // Format activities for display
    const activities = data?.map(activity => {
      let action = ''
      let target = ''

      // Handle Supabase join results (can be array or object)
      const tool = Array.isArray(activity.tool) ? activity.tool[0] : activity.tool
      const review = Array.isArray(activity.review) ? activity.review[0] : activity.review
      const collection = Array.isArray(activity.collection) ? activity.collection[0] : activity.collection

      switch (activity.activity_type) {
        case 'tool_favorited':
          action = 'Saved'
          target = tool?.name || 'a tool'
          break
        case 'review_created':
          action = 'Reviewed'
          target = tool?.name || review?.title || 'a tool'
          break
        case 'collection_created':
          action = 'Created collection'
          target = collection?.name || 'a collection'
          break
        case 'tool_added_to_collection':
          action = 'Added to collection'
          target = tool?.name || 'a tool'
          break
        default:
          action = activity.activity_type.replace(/_/g, ' ')
          target = ''
      }

      return {
        id: activity.id,
        action,
        target,
        time: activity.created_at,
        type: activity.activity_type
      }
    }) || []

    return createSuccessResponse({ activities })
  } catch (error) {
    logger.error('Error fetching user activity:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch activity',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
