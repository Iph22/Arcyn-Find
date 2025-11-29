import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    const { id } = await params
    const supabase = getSupabaseAdmin()

    // Check if current user follows this user
    const { data, error } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("following_id", id)
      .single()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    return createSuccessResponse({
      isFollowing: !!data,
    })
  } catch (error) {
    logger.error("Error checking follow status:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to check follow status",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

