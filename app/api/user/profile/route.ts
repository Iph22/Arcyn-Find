/**
 * User Profile API Route - Security Hardened
 * 
 * Security Features:
 * - User-based rate limiting
 * - Schema-based input validation
 * - XSS sanitization on profile fields
 * - URL validation for avatar/banner
 * - Rejects unexpected fields
 */

import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  parseAndValidateBody,
  updateProfileSchema
} from '@/lib/security'

/**
 * GET /api/user/profile
 * Get the current user's profile
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    // =========================================================================
    // RATE LIMITING
    // =========================================================================
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.STANDARD, user.id)

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }

    // =========================================================================
    // FETCH PROFILE
    // =========================================================================
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Profile doesn't exist yet
        return createSuccessResponse({ profile: null })
      }
      throw error
    }

    const response = createSuccessResponse({ profile: data })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error('[Profile] Error fetching user profile:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch profile',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

/**
 * PUT /api/user/profile
 * Update the current user's profile
 * Requires authentication
 */
export async function PUT(request: NextRequest) {
  try {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    // =========================================================================
    // RATE LIMITING - Stricter for write operations
    // =========================================================================
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.WRITE, user.id)

    if (!rateLimit.allowed) {
      logger.warn('[Profile] Rate limit exceeded for user:', user.id)
      return createRateLimitResponse(
        rateLimit,
        'Too many profile updates. Please wait before trying again.'
      )
    }

    // =========================================================================
    // INPUT VALIDATION - Schema-based with sanitization
    // =========================================================================
    const parseResult = await parseAndValidateBody(request, updateProfileSchema)

    if ('error' in parseResult) {
      return parseResult.error
    }

    const { display_name, username, bio, avatar_url, banner_url } = parseResult.data

    // =========================================================================
    // UPDATE PROFILE
    // =========================================================================
    const supabase = getSupabaseAdmin()

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (display_name !== undefined) updateData.display_name = display_name
    if (username !== undefined) updateData.username = username
    if (bio !== undefined) updateData.bio = bio
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url
    if (banner_url !== undefined) updateData.banner_url = banner_url

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(updateData, {
        onConflict: 'id',
      })
      .select()
      .single()

    if (error) {
      // Check for unique constraint violations (username already taken)
      if (error.code === '23505' && error.message?.includes('username')) {
        return createErrorResponse(
          'Username is already taken',
          409,
          'USERNAME_TAKEN'
        )
      }
      throw error
    }

    const response = createSuccessResponse({ profile: data })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error('[Profile] Error updating user profile:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update profile',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
