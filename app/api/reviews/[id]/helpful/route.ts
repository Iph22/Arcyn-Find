import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth-server"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"
import { ReviewsService } from "@/lib/services/reviews.service"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    await ReviewsService.markAsHelpful(id)
    return createSuccessResponse({ success: true })
  } catch (error) {
    logger.error("Error marking review as helpful:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to mark helpful",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

