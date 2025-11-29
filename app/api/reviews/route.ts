import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { validateBody, createReviewSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { ReviewsService } from '@/lib/services/reviews.service'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const toolId = searchParams.get('toolId')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Either toolId or userId must be provided
    if (!toolId && !userId) {
      return createErrorResponse('toolId or userId is required', 400, ErrorCodes.VALIDATION_ERROR)
    }

    // If fetching by userId, don't fetch stats
    if (userId) {
      const reviewsResult = await ReviewsService.getToolReviews(null, { limit, offset, userId })
      return createSuccessResponse({
        reviews: reviewsResult.reviews,
        total: reviewsResult.total,
      })
    }

    // Fetch reviews and stats for a tool
    const [reviewsResult, stats] = await Promise.all([
      ReviewsService.getToolReviews(toolId!, { limit, offset }),
      ReviewsService.getReviewStats(toolId!),
    ])

    return createSuccessResponse({
      reviews: reviewsResult.reviews,
      stats,
      total: reviewsResult.total,
    })
  } catch (error) {
    logger.error('Error fetching reviews:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch reviews',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for review submissions
    const rateLimit = checkRateLimit(request as Request, {
      windowMs: RATE_LIMITS.REVIEWS.window * 1000,
      maxRequests: RATE_LIMITS.REVIEWS.requests,
    })
    
    if (!rateLimit.allowed) {
      return createErrorResponse(
        'Too many review submissions. Please try again later.',
        429,
        ErrorCodes.RATE_LIMIT_EXCEEDED
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const body = await request.json()
    
    // Handle comment alias for review_text
    if (body.comment && !body.review_text) {
      body.review_text = body.comment
    }
    
    // Validate request body
    const validation = validateBody(createReviewSchema, body)
    if (!validation.success) {
      return createErrorResponse(validation.error, 400, ErrorCodes.VALIDATION_ERROR)
    }

    const { tool_id, rating, review_text, comment } = validation.data

    const review = await ReviewsService.createReview(user.id, {
      tool_id,
      rating,
      title: validation.data.title,
      review_text: review_text || comment || '',
    })

    const response = createSuccessResponse({ review })
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', RATE_LIMITS.REVIEWS.requests.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
    response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString())
    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'You have already reviewed this tool') {
      return createErrorResponse(
        'You have already reviewed this tool',
        409,
        'DUPLICATE_REVIEW'
      )
    }
    logger.error('Error creating review:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to create review',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

