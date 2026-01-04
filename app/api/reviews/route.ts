/**
 * Reviews API Route - Security Hardened
 * 
 * Security Features:
 * - Rate limiting (IP + user-based)
 * - Schema-based input validation
 * - XSS sanitization on review content
 * - Pagination validation
 * - Rejects unexpected fields
 */

import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { logger } from '@/lib/logger'
import { ReviewsService } from '@/lib/services/reviews.service'
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  parseAndValidateBody,
  createReviewSchema,
  extractPaginationParams,
  safeId
} from '@/lib/security'
import { z } from 'zod'

// Query params schema for GET
const getReviewsQuerySchema = z.object({
  toolId: safeId.optional(),
  userId: safeId.optional()
}).refine(
  (data) => data.toolId || data.userId,
  { message: 'Either toolId or userId is required' }
)

export async function GET(request: NextRequest) {
  try {
    // =========================================================================
    // RATE LIMITING - Public read endpoint
    // =========================================================================
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_READ)

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }

    // =========================================================================
    // INPUT VALIDATION - Query parameters
    // =========================================================================
    const searchParams = request.nextUrl.searchParams
    const toolId = searchParams.get('toolId')
    const userId = searchParams.get('userId')

    // Validate that at least one is provided
    if (!toolId && !userId) {
      return createErrorResponse(
        'toolId or userId is required',
        400,
        ErrorCodes.VALIDATION_ERROR
      )
    }

    // Extract and validate pagination
    const { limit, offset } = extractPaginationParams(searchParams)

    // =========================================================================
    // FETCH REVIEWS
    // =========================================================================

    // If fetching by userId, don't fetch stats
    if (userId) {
      const reviewsResult = await ReviewsService.getToolReviews(null, { limit, offset, userId })

      const response = createSuccessResponse({
        reviews: reviewsResult.reviews,
        total: reviewsResult.total,
      })

      // Add rate limit headers
      const headers = getRateLimitHeaders(rateLimit)
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    }

    // Fetch reviews and stats for a tool
    const [reviewsResult, stats] = await Promise.all([
      ReviewsService.getToolReviews(toolId!, { limit, offset }),
      ReviewsService.getReviewStats(toolId!),
    ])

    const response = createSuccessResponse({
      reviews: reviewsResult.reviews,
      stats,
      total: reviewsResult.total,
    })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error('[Reviews] Error fetching reviews:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch reviews',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // =========================================================================
    // AUTHENTICATION CHECK FIRST (for user-based rate limiting)
    // =========================================================================
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    // =========================================================================
    // RATE LIMITING - Strict for write operations, user-based
    // =========================================================================
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.WRITE, user.id)

    if (!rateLimit.allowed) {
      logger.warn('[Reviews] Rate limit exceeded for user:', user.id)
      return createRateLimitResponse(
        rateLimit,
        'Too many review submissions. Please wait before trying again.'
      )
    }

    // =========================================================================
    // INPUT VALIDATION - Schema-based with sanitization
    // =========================================================================
    const parseResult = await parseAndValidateBody(request, createReviewSchema)

    if ('error' in parseResult) {
      return parseResult.error
    }

    const { tool_id, rating, review_text, comment, title } = parseResult.data

    // =========================================================================
    // CREATE REVIEW
    // =========================================================================
    const review = await ReviewsService.createReview(user.id, {
      tool_id,
      rating,
      title: title || undefined,
      review_text: review_text || comment || '',
    })

    const response = createSuccessResponse({ review })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'You have already reviewed this tool') {
      return createErrorResponse(
        'You have already reviewed this tool',
        409,
        'DUPLICATE_REVIEW'
      )
    }
    logger.error('[Reviews] Error creating review:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to create review',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
