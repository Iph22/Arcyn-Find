import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth-server"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"
import { FavoritesService } from "@/lib/services/favorites.service"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const { toolId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return createSuccessResponse({ isFavorite: false })
    }

    const favorites = await FavoritesService.getUserFavorites(user.id)
    const isFavorite = favorites.some((fav: any) => fav.tool_id === toolId)
    return createSuccessResponse({ isFavorite })
  } catch (error) {
    logger.error("Error checking favorite status:", error)
    return createSuccessResponse({ isFavorite: false })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const { toolId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    await FavoritesService.removeFavorite(user.id, toolId)
    return createSuccessResponse({ success: true })
  } catch (error) {
    logger.error("Error removing favorite:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to remove favorite",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

