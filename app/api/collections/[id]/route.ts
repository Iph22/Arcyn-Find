/**
 * Collection by ID API Route - Security Hardened
 * 
 * Security Features:
 * - User-based rate limiting
 * - Schema-based input validation
 * - Ownership verification
 * - ID format validation
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
  updateCollectionSchema,
  safeId
} from "@/lib/security"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // =========================================================================
    // RATE LIMITING - Public read endpoint
    // =========================================================================
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_READ)

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
      return createErrorResponse('Invalid collection ID format', 400, ErrorCodes.VALIDATION_ERROR)
    }

    // =========================================================================
    // FETCH COLLECTION
    // =========================================================================
    const collection = await CollectionsService.getCollectionById(id)

    const response = createSuccessResponse({ collection })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'Collection not found') {
      return createErrorResponse("Collection not found", 404, ErrorCodes.NOT_FOUND)
    }
    logger.error("[Collections] Error fetching collection:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch collection",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

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
      return createErrorResponse('Invalid collection ID format', 400, ErrorCodes.VALIDATION_ERROR)
    }

    // Parse and validate body
    const parseResult = await parseAndValidateBody(request, updateCollectionSchema)

    if ('error' in parseResult) {
      return parseResult.error
    }

    // =========================================================================
    // OWNERSHIP VERIFICATION
    // =========================================================================
    const isOwner = await CollectionsService.verifyOwnership(id, user.id)
    if (!isOwner) {
      return createErrorResponse("Forbidden", 403, ErrorCodes.FORBIDDEN)
    }

    // =========================================================================
    // UPDATE COLLECTION
    // =========================================================================
    const collection = await CollectionsService.updateCollection(id, parseResult.data)

    const response = createSuccessResponse({ collection })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error("[Collections] Error updating collection:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to update collection",
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
      return createErrorResponse('Invalid collection ID format', 400, ErrorCodes.VALIDATION_ERROR)
    }

    // =========================================================================
    // OWNERSHIP VERIFICATION
    // =========================================================================
    const isOwner = await CollectionsService.verifyOwnership(id, user.id)
    if (!isOwner) {
      return createErrorResponse("Forbidden", 403, ErrorCodes.FORBIDDEN)
    }

    // =========================================================================
    // DELETE COLLECTION
    // =========================================================================
    await CollectionsService.deleteCollection(id)

    const response = createSuccessResponse({ success: true })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error("[Collections] Error deleting collection:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to delete collection",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
