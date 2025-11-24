import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { logger } from '@/lib/logger'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * DELETE /api/user/delete-account
 * Deletes the current user's account and all associated data
 * Requires authentication
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth()
    if (!userId) {
      logger.error('Delete account: User not authenticated')
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    logger.log(`Delete account: Attempting to delete user ${userId}`)

    // Delete user profile data from Supabase
    try {
      const supabaseAdmin = getSupabaseAdmin()
      
      // Delete user profile and related data
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('id', userId)
      
      if (profileError) {
        logger.error('Error deleting user profile:', profileError)
        // Continue anyway - we still want to delete the Clerk user
      }
      
      // Note: Other tables like reviews, collections, etc. should have
      // ON DELETE CASCADE constraints to automatically clean up
    } catch (supabaseError) {
      logger.error('Error cleaning up Supabase data:', supabaseError)
      // Continue anyway - we still want to delete the Clerk user
    }

    // Delete user from Clerk
    // This requires Clerk Backend API
    const clerkApiUrl = `https://api.clerk.com/v1/users/${userId}`
    const response = await fetch(clerkApiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('Delete account: Error from Clerk API:', errorData)
      return createErrorResponse(
        'Failed to delete account. Please try again.',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    }

    logger.log(`Delete account: Successfully deleted user ${userId}`)

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

