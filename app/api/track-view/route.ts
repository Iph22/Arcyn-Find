/**
 * Track View API Route - Enhanced with Database Tracking
 * 
 * Security Features:
 * - Rate limiting to prevent view-count manipulation
 * - Schema-based input validation
 * - ID format validation
 *
 * Features:
 * - Persistent view tracking in database
 * - IP hashing for unique visitor tracking
 * - An anonymous view id, which is NOT the auth session — see VIEW_ID_COOKIE
 */

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
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
 * Anonymous id used to tell viewers apart in `tool_views`.
 *
 * Deliberately NOT the auth session cookie. This route used to read
 * `arcyn-session` — one character away from the real `arcyn_session` in
 * lib/session.ts — so the match never succeeded and every view row was written
 * with a null session_id. Correcting the name alone would have been worse than
 * the bug: `arcyn_session` carries a signed session token, i.e. a live
 * credential, and matching it would have copied that token in plaintext into an
 * analytics table that no read path authenticates against.
 *
 * This cookie therefore carries nothing but a random value. It is httpOnly
 * because no client code needs to read it, and it expires after 24 hours —
 * which matches the window `view_count_24h` reports on, and stops it becoming a
 * durable cross-visit identifier. It is minted only when absent, never
 * refreshed on use, so the 24 hours is a hard ceiling rather than a rolling one.
 */
const VIEW_ID_COOKIE = 'arcyn_view_id'
const VIEW_ID_MAX_AGE_SECONDS = 60 * 60 * 24

/** Anchored on a cookie boundary: a cookie whose name merely *ends* with ours
 *  must not satisfy the match. */
const VIEW_ID_PATTERN = new RegExp(`(?:^|;\\s*)${VIEW_ID_COOKIE}=([^;]+)`)

function readViewId(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  return header.match(VIEW_ID_PATTERN)?.[1] ?? null
}

/**
 * POST /api/track-view
 * Records a view/click on an AI tool against its view counters
 *
 * Rate limited to prevent view-count manipulation attacks
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

    // Anonymous viewer id — see VIEW_ID_COOKIE above for why this is not the
    // auth session cookie.
    const existingViewId = readViewId(request)
    const viewId = existingViewId ?? randomUUID().replace(/-/g, '')

    // =========================================================================
    // TRACK VIEW WITH NEW SERVICE
    // =========================================================================
    // `sessionId` is the service's name for the `tool_views.session_id` column;
    // what it now receives is the anonymous view id, not an auth session.
    const result = await trackToolView(aiId, {
      ip,
      sessionId: viewId,
      source: 'web'
    })

    const response = createSuccessResponse({
      success: result.success,
      viewCount: result.viewCount
    })

    // Only on first sight, so the lifetime stays a ceiling rather than a
    // sliding window that renews for as long as someone keeps browsing.
    if (!existingViewId) {
      response.cookies.set(VIEW_ID_COOKIE, viewId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: VIEW_ID_MAX_AGE_SECONDS,
      })
    }

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

