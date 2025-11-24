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

    // Get user's saved tools (favorites) with tool details
    const { data: favorites, error } = await supabase
      .from("user_favorites")
      .select(`
        id,
        created_at,
        tool:ai_tools (
          id,
          name,
          description,
          image,
          category,
          access_type,
          tags
        )
      `)
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      if (error.code === "42P01") {
        return createSuccessResponse({ savedTools: [] })
      }
      throw error
    }

    return createSuccessResponse({
      savedTools: favorites || [],
    })
  } catch (error) {
    console.error("Error fetching saved tools:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch saved tools",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

