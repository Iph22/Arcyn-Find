import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * GET /api/user/saved-tools
 * Get the current user's saved/favorited tools
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const supabase = getSupabaseAdmin()

    // Get saved tools with tool details
    const { data, error } = await supabase
      .from('user_favorites')
      .select(`
        id,
        created_at,
        tool:ai_tools (
          id,
          name,
          description,
          image,
          category,
          access_type,
          tags
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      // Bounded, matching the sibling route at app/api/users/[id]/saved-tools.
      // This was unbounded: every favourite with its full joined tool row, so
      // the response grew without limit as a user saved more. PostgREST would
      // have silently capped it at 1000 anyway (§2), which is worse than a cap
      // we chose, because it looks like a complete answer.
      .limit(50)

    if (error) {
      throw error
    }

    // Transform the data to include the tool directly
    const savedTools = data?.map(item => ({
      id: item.id,
      created_at: item.created_at,
      tool: Array.isArray(item.tool) ? item.tool[0] : item.tool
    })) || []

    return createSuccessResponse({ savedTools })
  } catch (error) {
    logger.error('Error fetching saved tools:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch saved tools',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
