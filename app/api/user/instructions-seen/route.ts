import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/user/instructions-seen
 * Mark instructions as seen for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
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
    console.error('Error marking instructions as seen:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to mark instructions as seen',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
