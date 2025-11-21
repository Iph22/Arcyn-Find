import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    // Increment helpful_count
    const { data, error } = await supabase.rpc("increment_helpful_count", {
      review_id: id,
    })

    if (error) {
      // If RPC doesn't exist, do it manually
      const { data: review } = await supabase
        .from("tool_reviews")
        .select("helpful_count")
        .eq("id", id)
        .single()

      if (review) {
        const { error: updateError } = await supabase
          .from("tool_reviews")
          .update({ helpful_count: (review.helpful_count || 0) + 1 })
          .eq("id", id)

        if (updateError) throw updateError
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error marking review as helpful:", error)
    return NextResponse.json(
      { error: error.message || "Failed to mark helpful" },
      { status: 500 }
    )
  }
}

