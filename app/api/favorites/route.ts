import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth-server"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"
import { FavoritesService } from "@/lib/services/favorites.service"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    const favorites = await FavoritesService.getUserFavorites(user.id)
    return createSuccessResponse({ favorites })
  } catch (error) {
    logger.error("Error fetching favorites:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch favorites",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    const body = await request.json()
    const { tool_id } = body

    if (!tool_id || typeof tool_id !== 'string') {
      return createErrorResponse("tool_id is required", 400, ErrorCodes.VALIDATION_ERROR)
    }

    await FavoritesService.addFavorite(user.id, tool_id)
    return createSuccessResponse({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Already favorited') {
      return createErrorResponse("Already favorited", 409, "DUPLICATE_FAVORITE")
    }
    logger.error("Error adding favorite:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to add favorite",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

