/**
 * Collections API Route - Security Hardened
 * 
 * Security Features:
 * - User-based rate limiting (authenticated endpoints)
 * - Schema-based input validation
 * - XSS sanitization on collection names/descriptions
 * - Rejects unexpected fields
 */

import { NextRequest } from "next/server"
import { getCurrentUser } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"
import { CollectionsService } from "@/lib/services/collections.service"
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  parseAndValidateBody,
  createCollectionSchema
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
    // RATE LIMITING - Standard for read operations
    // =========================================================================
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.STANDARD, user.id)

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }

    // =========================================================================
    // FETCH COLLECTIONS
    // =========================================================================
    const collections = await CollectionsService.getUserCollections(user.id)

    const response = createSuccessResponse({ collections })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error("[Collections] Error fetching collections:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch collections",
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
    // RATE LIMITING - Strict for write operations
    // =========================================================================
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.WRITE, user.id)

    if (!rateLimit.allowed) {
      logger.warn('[Collections] Rate limit exceeded for user:', user.id)
      return createRateLimitResponse(
        rateLimit,
        'Too many collection operations. Please wait before trying again.'
      )
    }

    // =========================================================================
    // INPUT VALIDATION - Schema-based with sanitization
    // =========================================================================
    const parseResult = await parseAndValidateBody(request, createCollectionSchema)

    if ('error' in parseResult) {
      return parseResult.error
    }

    // =========================================================================
    // CREATE COLLECTION
    // =========================================================================
    const collection = await CollectionsService.createCollection(user.id, parseResult.data)

    const response = createSuccessResponse({ collection })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error("[Collections] Error creating collection:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to create collection",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
