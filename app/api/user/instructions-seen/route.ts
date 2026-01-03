import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * POST /api/user/instructions-seen
 * Mark instructions as seen for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        instructions_seen: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      })

    if (error) {
      throw error
    }

    return createSuccessResponse({ message: 'Instructions marked as seen' })
  } catch (error) {
    logger.error('Error marking instructions as seen:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to mark instructions as seen',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
