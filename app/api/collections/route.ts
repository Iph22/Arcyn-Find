import { NextRequest } from "next/server"
import { auth } from '@clerk/nextjs/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { validateBody, createCollectionSchema } from "@/lib/validation"
import { logger } from "@/lib/logger"
import { CollectionsService } from "@/lib/services/collections.service"

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    const collections = await CollectionsService.getUserCollections(userId)
    return createSuccessResponse({ collections })
  } catch (error) {
    logger.error("Error fetching collections:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch collections",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    const body = await request.json()
    
    // Validate request body
    const validation = validateBody(createCollectionSchema, body)
    if (!validation.success) {
      return createErrorResponse(validation.error, 400, ErrorCodes.VALIDATION_ERROR)
    }

    const collection = await CollectionsService.createCollection(userId, validation.data)
    return createSuccessResponse({ collection })
  } catch (error) {
    logger.error("Error creating collection:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to create collection",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

