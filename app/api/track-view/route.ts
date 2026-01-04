/**
 * Track View API Route - Security Hardened
 * 
 * Security Features:
 * - Rate limiting to prevent popularity manipulation
 * - Schema-based input validation
 * - ID format validation
 */

import { NextResponse } from 'next/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { logger } from '@/lib/logger'
import { ToolsService } from '@/lib/services/tools.service'
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  parseAndValidateBody,
  trackViewSchema
} from '@/lib/security'

/**
 * POST /api/track-view
 * Tracks a view/click on an AI tool and updates popularity in real-time
 * 
 * Rate limited to prevent popularity manipulation attacks
 */
export async function POST(request: Request) {
  try {
    // =========================================================================
    // RATE LIMITING - Strict to prevent popularity manipulation
    // Using a custom config: 30 views per minute per IP
    // =========================================================================
    const rateLimit = checkRateLimit(request, {
      maxRequests: 30,
      windowSeconds: 60,
      burstLimit: 5, // Max 5 in a second
      keyPrefix: 'track'
    })

    if (!rateLimit.allowed) {
      // Silent rate limit - don't expose that we're tracking
      // Just return success but don't update
      logger.warn('[TrackView] Rate limit exceeded')
      return createSuccessResponse({
        success: true,
        message: 'View noted'
      })
    }

    // =========================================================================
    // INPUT VALIDATION - Schema-based
    // =========================================================================
    const parseResult = await parseAndValidateBody(request, trackViewSchema)

    if ('error' in parseResult) {
      return parseResult.error
    }

    const { aiId } = parseResult.data

    // =========================================================================
    // UPDATE POPULARITY
    // =========================================================================
    const newPopularity = await ToolsService.updatePopularity(aiId, 0.1)

    const response = createSuccessResponse({
      success: true,
      newPopularity
    })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'Tool not found') {
      return createErrorResponse('Tool not found', 404, ErrorCodes.NOT_FOUND)
    }
    logger.error('[TrackView] Error tracking view:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
