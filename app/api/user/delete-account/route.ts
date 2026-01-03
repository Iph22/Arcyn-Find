import { NextRequest } from 'next/server'
import { getCurrentUser, deleteAccount as deleteUserAccount } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { logger } from '@/lib/logger'

/**
 * DELETE /api/user/delete-account
 * Deletes the current user's account and all associated data
 * Requires authentication
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get current user from Google OAuth
    const user = await getCurrentUser()
    if (!user) {
      logger.error('Delete account: User not authenticated')
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    logger.log(`Delete account: Attempting to delete user ${user.id}`)

    // Use the deleteAccount function from google-auth
    const result = await deleteUserAccount()

    if (!result.success) {
      logger.error('Delete account error:', result.error)
      return createErrorResponse(
        result.error || 'Failed to delete account',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    }

    logger.log(`Delete account: Successfully deleted user ${user.id}`)

    return createSuccessResponse({
      message: 'Account deleted successfully',
    })
  } catch (error) {
    logger.error('Unexpected error in delete account route:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to delete account',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
