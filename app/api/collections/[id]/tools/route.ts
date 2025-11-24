import { NextRequest } from "next/server"
import { auth } from '@clerk/nextjs/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"
import { CollectionsService } from "@/lib/services/collections.service"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    const body = await request.json()
    const { tool_id } = body

    if (!tool_id || typeof tool_id !== 'string') {
      return createErrorResponse("tool_id is required", 400, ErrorCodes.VALIDATION_ERROR)
    }

    // Verify ownership
    const isOwner = await CollectionsService.verifyOwnership(id, userId)
    if (!isOwner) {
      return createErrorResponse("Forbidden", 403, ErrorCodes.FORBIDDEN)
    }

    await CollectionsService.addToolToCollection(id, tool_id)
    return createSuccessResponse({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Tool already in collection') {
      return createErrorResponse("Tool already in collection", 409, "DUPLICATE_ITEM")
    }
    logger.error("Error adding tool to collection:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to add tool",
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

    const searchParams = request.nextUrl.searchParams
    const tool_id = searchParams.get("tool_id")

    if (!tool_id) {
      return createErrorResponse("tool_id is required", 400, ErrorCodes.VALIDATION_ERROR)
    }

    // Verify ownership
    const isOwner = await CollectionsService.verifyOwnership(id, userId)
    if (!isOwner) {
      return createErrorResponse("Forbidden", 403, ErrorCodes.FORBIDDEN)
    }

    await CollectionsService.removeToolFromCollection(id, tool_id)
    return createSuccessResponse({ success: true })
  } catch (error) {
    logger.error("Error removing tool from collection:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to remove tool",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

