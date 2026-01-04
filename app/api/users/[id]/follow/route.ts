/**
 * User Follow API Route - Security Hardened
 * 
 * Security Features:
 * - User-based rate limiting
 * - ID validation
 * - Self-follow prevention
 */

import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/google-auth"
import { getSupabaseAdmin } from "@/lib/supabase"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  safeId
} from "@/lib/security"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    // =========================================================================
    // RATE LIMITING - Prevent follow/unfollow spam
    // =========================================================================
    const rateLimit = checkRateLimit(request, {
      maxRequests: 30,
      windowSeconds: 60,
      burstLimit: 5,
      keyPrefix: 'follow'
    }, user.id)

    if (!rateLimit.allowed) {
      logger.warn('[Follow] Rate limit exceeded for user:', user.id)
      return createRateLimitResponse(
        rateLimit,
        'Too many follow actions. Please wait before trying again.'
      )
    }

    // =========================================================================
    // INPUT VALIDATION
    // =========================================================================
    const { id } = await params

    // Validate ID format
    const idValidation = safeId.safeParse(id)
    if (!idValidation.success) {
      return createErrorResponse(
        'Invalid user ID format',
        400,
        ErrorCodes.VALIDATION_ERROR
      )
    }

    // Prevent self-follow
    if (user.id === id) {
      return createErrorResponse(
        "Cannot follow yourself",
        400,
        ErrorCodes.VALIDATION_ERROR
      )
    }

    // =========================================================================
    // FOLLOW USER
    // =========================================================================
    const supabase = getSupabaseAdmin()

    // Check if already following
    const { data: existing } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", id)
      .single()

    if (existing) {
      return createSuccessResponse({ message: "Already following" })
    }

    // Add follow relationship
    const { error } = await supabase.from("user_follows").insert({
      follower_id: user.id,
      following_id: id,
    })

    if (error) {
      throw error
    }

    const response = createSuccessResponse({ message: "Followed successfully" })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error("[Follow] Error following user:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to follow user",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    // =========================================================================
    // RATE LIMITING
    // =========================================================================
    const rateLimit = checkRateLimit(request, {
      maxRequests: 30,
      windowSeconds: 60,
      burstLimit: 5,
      keyPrefix: 'follow'
    }, user.id)

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }

    // =========================================================================
    // INPUT VALIDATION
    // =========================================================================
    const { id } = await params

    // Validate ID format
    const idValidation = safeId.safeParse(id)
    if (!idValidation.success) {
      return createErrorResponse(
        'Invalid user ID format',
        400,
        ErrorCodes.VALIDATION_ERROR
      )
    }

    // =========================================================================
    // UNFOLLOW USER
    // =========================================================================
    const supabase = getSupabaseAdmin()

    // Remove follow relationship
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", id)

    if (error) {
      throw error
    }

    const response = createSuccessResponse({ message: "Unfollowed successfully" })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error("[Follow] Error unfollowing user:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to unfollow user",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
