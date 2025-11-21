import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { rating, comment } = body

    const supabase = getSupabaseAdmin()

    // Verify ownership
    const { data: existing } = await supabase
      .from("tool_reviews")
      .select("user_id")
      .eq("id", id)
      .single()

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updates: any = {}
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "Rating must be between 1 and 5" },
          { status: 400 }
        )
      }
      updates.rating = rating
    }
    if (comment !== undefined) {
      updates.comment = comment
    }

    const { data, error } = await supabase
      .from("tool_reviews")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ review: data })
  } catch (error: any) {
    console.error("Error updating review:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update review" },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Verify ownership
    const { data: existing } = await supabase
      .from("tool_reviews")
      .select("user_id")
      .eq("id", id)
      .single()

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await supabase
      .from("tool_reviews")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting review:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete review" },
      { status: 500 }
    )
  }
}

