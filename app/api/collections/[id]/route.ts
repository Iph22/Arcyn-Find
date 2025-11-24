import { NextRequest } from "next/server"
import { auth } from '@clerk/nextjs/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"
import { CollectionsService } from "@/lib/services/collections.service"
import { validateBody, updateCollectionSchema } from "@/lib/validation"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const collection = await CollectionsService.getCollectionById(id)
    return createSuccessResponse({ collection })
  } catch (error) {
    if (error instanceof Error && error.message === 'Collection not found') {
      return createErrorResponse("Collection not found", 404, ErrorCodes.NOT_FOUND)
    }
    logger.error("Error fetching collection:", error)
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
    const { id } = await params
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    // Verify ownership
    const isOwner = await CollectionsService.verifyOwnership(id, userId)
    if (!isOwner) {
      return createErrorResponse("Forbidden", 403, ErrorCodes.FORBIDDEN)
    }

    const body = await request.json()
    
    // Validate request body
    const validation = validateBody(updateCollectionSchema, body)
    if (!validation.success) {
      return createErrorResponse(validation.error, 400, ErrorCodes.VALIDATION_ERROR)
    }

    const collection = await CollectionsService.updateCollection(id, validation.data)
    return createSuccessResponse({ collection })
  } catch (error) {
    logger.error("Error updating collection:", error)
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
    const { id } = await params
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    // Verify ownership
    const isOwner = await CollectionsService.verifyOwnership(id, userId)
    if (!isOwner) {
      return createErrorResponse("Forbidden", 403, ErrorCodes.FORBIDDEN)
    }

    await CollectionsService.deleteCollection(id)
    return createSuccessResponse({ success: true })
  } catch (error) {
    logger.error("Error deleting collection:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to delete collection",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

