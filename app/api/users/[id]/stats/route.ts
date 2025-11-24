import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseAdmin()

    // Get followers count
    const { count: followersCount } = await supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", id)

    // Get following count
    const { count: followingCount } = await supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", id)

    // Get reviews count
    const { count: reviewsCount } = await supabase
      .from("tool_reviews")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id)

    // Get saved tools count
    const { count: savedToolsCount } = await supabase
      .from("user_favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id)

    // Get collections count
    const { count: collectionsCount } = await supabase
      .from("collections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id)

    return createSuccessResponse({
      stats: {
        followers: followersCount || 0,
        following: followingCount || 0,
        reviews: reviewsCount || 0,
        savedTools: savedToolsCount || 0,
        collections: collectionsCount || 0,
      },
    })
  } catch (error) {
    console.error("Error fetching user stats:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch user stats",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

