/**
 * Delete Account API Route - Security Hardened
 * 
 * Security Features:
 * - Strict rate limiting (1/min to prevent abuse)
 * - Authentication required
 * - Proper logging for audit trail
 */

import { NextRequest } from 'next/server'
import { getCurrentUser, deleteAccount as deleteUserAccount } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { logger } from '@/lib/logger'
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
} from '@/lib/security'

/**
 * DELETE /api/user/delete-account
 * Deletes the current user's account and all associated data
 * Requires authentication
 * 
 * This is a destructive action with strict rate limiting
 */
export async function DELETE(request: NextRequest) {
  try {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    const user = await getCurrentUser()
    if (!user) {
      logger.error('[DeleteAccount] Attempt without authentication')
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    // =========================================================================
    // RATE LIMITING - Very strict for destructive actions (1/min)
    // =========================================================================
    const rateLimit = checkRateLimit(request, {
      maxRequests: 1,
      windowSeconds: 60,
      burstLimit: 1,
      keyPrefix: 'delete-account'
    }, user.id)

    if (!rateLimit.allowed) {
      logger.warn('[DeleteAccount] Rate limit exceeded for user:', user.id)
      return createRateLimitResponse(
        rateLimit,
        'Account deletion rate limit exceeded. Please wait before trying again.'
      )
    }

    // =========================================================================
    // AUDIT LOGGING
    // =========================================================================
    logger.log(`[DeleteAccount] User ${user.id} (${user.email}) requested account deletion`)

    // =========================================================================
    // DELETE ACCOUNT
    // =========================================================================
    const result = await deleteUserAccount()

    if (!result.success) {
      logger.error('[DeleteAccount] Delete failed for user:', user.id, result.error)
      return createErrorResponse(
        result.error || 'Failed to delete account',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    }

    // =========================================================================
    // SUCCESS
    // =========================================================================
    logger.log(`[DeleteAccount] Successfully deleted account for user: ${user.id}`)

    const response = createSuccessResponse({
      message: 'Account deleted successfully',
    })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error('[DeleteAccount] Unexpected error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to delete account',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
