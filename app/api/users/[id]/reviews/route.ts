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

    // Get user's reviews with tool details
    const { data: reviews, error } = await supabase
      .from("tool_reviews")
      .select(`
        id,
        rating,
        title,
        review_text,
        created_at,
        tool:ai_tools (
          id,
          name,
          image
        )
      `)
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      if (error.code === "42P01") {
        return createSuccessResponse({ reviews: [] })
      }
      throw error
    }

    return createSuccessResponse({
      reviews: reviews || [],
    })
  } catch (error) {
    console.error("Error fetching reviews:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch reviews",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

