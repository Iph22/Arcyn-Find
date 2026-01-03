import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/google-auth"
import { getSupabaseAdmin } from "@/lib/supabase"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    const { id } = await params

    if (user.id === id) {
      return createErrorResponse("Cannot follow yourself", 400, ErrorCodes.VALIDATION_ERROR)
    }

    const supabase = getSupabaseAdmin()

    // Check if already following
    const { data: existing } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", id)
      .single()

    if (existing) {
      return createSuccessResponse({ message: "Already following" })
    }

    // Add follow relationship
    const { error } = await supabase.from("user_follows").insert({
      follower_id: user.id,
      following_id: id,
    })

    if (error) {
      throw error
    }

    return createSuccessResponse({ message: "Followed successfully" })
  } catch (error) {
    logger.error("Error following user:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to follow user",
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
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse("Unauthorized", 401, ErrorCodes.UNAUTHORIZED)
    }

    const { id } = await params
    const supabase = getSupabaseAdmin()

    // Remove follow relationship
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", id)

    if (error) {
      throw error
    }

    return createSuccessResponse({ message: "Unfollowed successfully" })
  } catch (error) {
    logger.error("Error unfollowing user:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to unfollow user",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

