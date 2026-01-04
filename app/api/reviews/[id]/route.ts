/**
 * Review by ID API Route - Security Hardened
 * 
 * Security Features:
 * - User-based rate limiting
 * - Schema-based input validation
 * - Ownership verification
 */

import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth-server"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"
import { ReviewsService } from "@/lib/services/reviews.service"
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  parseAndValidateBody,
  updateReviewSchema,
  safeId
} from "@/lib/security"

export async function PUT(
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
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.WRITE, user.id)

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
      return createErrorResponse('Invalid review ID format', 400, ErrorCodes.VALIDATION_ERROR)
    }

    // Parse and validate body
    const parseResult = await parseAndValidateBody(request, updateReviewSchema)

    if ('error' in parseResult) {
      return parseResult.error
    }

    // =========================================================================
    // OWNERSHIP VERIFICATION
    // =========================================================================
    const isOwner = await ReviewsService.verifyOwnership(id, user.id)
    if (!isOwner) {
      return createErrorResponse("Forbidden", 403, ErrorCodes.FORBIDDEN)
    }

    // =========================================================================
    // UPDATE REVIEW
    // =========================================================================
    const { rating, title, review_text } = parseResult.data

    const review = await ReviewsService.updateReview(id, {
      rating,
      title,
      review_text,
    })

    const response = createSuccessResponse({ review })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error("[Reviews] Error updating review:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to update review",
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
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.WRITE, user.id)

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
      return createErrorResponse('Invalid review ID format', 400, ErrorCodes.VALIDATION_ERROR)
    }

    // =========================================================================
    // OWNERSHIP VERIFICATION
    // =========================================================================
    const isOwner = await ReviewsService.verifyOwnership(id, user.id)
    if (!isOwner) {
      return createErrorResponse("Forbidden", 403, ErrorCodes.FORBIDDEN)
    }

    // =========================================================================
    // DELETE REVIEW
    // =========================================================================
    await ReviewsService.deleteReview(id)

    const response = createSuccessResponse({ success: true })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error("[Reviews] Error deleting review:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to delete review",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
