import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { logger } from "@/lib/logger"

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
      logger.error("Error fetching reviews:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      if (error.code === "42P01") {
        return createSuccessResponse({ reviews: [] })
      }
      throw error
    }

    // Ensure tool data is properly formatted (Supabase might return it as array or object)
    const formattedReviews = (reviews || []).map((review: any) => {
      // Handle case where tool might be an array (shouldn't happen with FK, but just in case)
      const tool = Array.isArray(review.tool) ? review.tool[0] : review.tool
      
      return {
        id: review.id,
        rating: review.rating,
        title: review.title,
        review_text: review.review_text,
        created_at: review.created_at,
        tool: tool ? {
          id: tool.id,
          name: tool.name,
          image: tool.image
        } : null
      }
    })

    return createSuccessResponse({
      reviews: formattedReviews,
    })
  } catch (error) {
    logger.error("Error fetching reviews:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch reviews",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

