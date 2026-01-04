/**
 * Favorites API Route - Security Hardened
 * 
 * Security Features:
 * - User-based rate limiting
 * - Schema-based input validation
 * - Tool ID format validation
 */

import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth-server"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"
import { FavoritesService } from "@/lib/services/favorites.service"
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  parseAndValidateBody,
  toolIdSchema
} from "@/lib/security"

export async function GET(request: NextRequest) {
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
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.STANDARD, user.id)

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }

    // =========================================================================
    // FETCH FAVORITES
    // =========================================================================
    const favorites = await FavoritesService.getUserFavorites(user.id)

    const response = createSuccessResponse({ favorites })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error("[Favorites] Error fetching favorites:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch favorites",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    // =========================================================================
    // RATE LIMITING - Stricter for write operations
    // =========================================================================
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.WRITE, user.id)

    if (!rateLimit.allowed) {
      logger.warn('[Favorites] Rate limit exceeded for user:', user.id)
      return createRateLimitResponse(
        rateLimit,
        'Too many favorite operations. Please wait before trying again.'
      )
    }

    // =========================================================================
    // INPUT VALIDATION - Schema-based
    // =========================================================================
    const parseResult = await parseAndValidateBody(request, toolIdSchema)

    if ('error' in parseResult) {
      return parseResult.error
    }

    const { tool_id } = parseResult.data

    // =========================================================================
    // ADD FAVORITE
    // =========================================================================
    await FavoritesService.addFavorite(user.id, tool_id)

    const response = createSuccessResponse({ success: true })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'Already favorited') {
      return createErrorResponse("Already favorited", 409, "DUPLICATE_FAVORITE")
    }
    logger.error("[Favorites] Error adding favorite:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to add favorite",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
