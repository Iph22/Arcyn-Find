/**
 * Track View API Route - Enhanced with Database Tracking
 * 
 * Security Features:
 * - Rate limiting to prevent popularity manipulation
 * - Schema-based input validation
 * - ID format validation
 * 
 * New Features:
 * - Persistent view tracking in database
 * - IP hashing for unique visitor tracking
 * - Session-based tracking
 */

import { NextResponse } from 'next/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { logger } from '@/lib/logger'
import { trackToolView } from '@/lib/services/view-tracking.service'
import {
  checkRateLimit,
  getRateLimitHeaders,
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
    // GET CLIENT INFO FOR TRACKING
    // =========================================================================
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

    // Get or generate session ID from cookie
    const cookies = request.headers.get('cookie') || ''
    const sessionMatch = cookies.match(/arcyn-session=([^;]+)/)
    const sessionId = sessionMatch ? sessionMatch[1] : undefined

    // =========================================================================
    // TRACK VIEW WITH NEW SERVICE
    // =========================================================================
    const result = await trackToolView(aiId, {
      ip,
      sessionId,
      source: 'web'
    })

    const response = createSuccessResponse({
      success: result.success,
      newPopularity: result.newPopularity
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

