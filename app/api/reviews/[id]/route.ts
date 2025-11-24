import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth-server"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { validateBody, updateReviewSchema } from "@/lib/validation"
import { logger } from "@/lib/logger"
import { ReviewsService } from "@/lib/services/reviews.service"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    const body = await request.json()
    
    // Handle comment alias for review_text
    if (body.comment && !body.review_text) {
      body.review_text = body.comment
    }
    
    // Validate request body
    const validation = validateBody(updateReviewSchema, body)
    if (!validation.success) {
      return createErrorResponse(validation.error, 400, ErrorCodes.VALIDATION_ERROR)
    }

    // Verify ownership
    const isOwner = await ReviewsService.verifyOwnership(id, user.id)
    if (!isOwner) {
      return createErrorResponse("Forbidden", 403, ErrorCodes.FORBIDDEN)
    }

    const review = await ReviewsService.updateReview(id, {
      rating: validation.data.rating,
      title: validation.data.title,
      review_text: validation.data.review_text,
    })

    return createSuccessResponse({ review })
  } catch (error) {
    logger.error("Error updating review:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to update review",
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
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    // Verify ownership
    const isOwner = await ReviewsService.verifyOwnership(id, user.id)
    if (!isOwner) {
      return createErrorResponse("Forbidden", 403, ErrorCodes.FORBIDDEN)
    }

    await ReviewsService.deleteReview(id)
    return createSuccessResponse({ success: true })
  } catch (error) {
    logger.error("Error deleting review:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to delete review",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

