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
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return createErrorResponse("User not found", 404, ErrorCodes.NOT_FOUND)
      }
      if (error.code === "42P01") {
        return createErrorResponse(
          "User profiles table does not exist",
          500,
          ErrorCodes.INTERNAL_ERROR
        )
      }
      throw error
    }

    return createSuccessResponse({ user: data })
  } catch (error) {
    logger.error("Error fetching user:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch user",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

