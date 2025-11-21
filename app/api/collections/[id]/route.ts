import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("collections")
      .select(
        `
        *,
        collection_items(
          tool_id,
          ai_tools(*)
        )
      `
      )
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ collection: data })
  } catch (error: any) {
    console.error("Error fetching collection:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch collection" },
      { status: 500 }
    )
  }
}

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
    const supabase = getSupabaseAdmin()

    // Verify ownership
    const { data: existing } = await supabase
      .from("collections")
      .select("user_id")
      .eq("id", id)
      .single()

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("collections")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ collection: data })
  } catch (error: any) {
    console.error("Error updating collection:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update collection" },
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
      .from("collections")
      .select("user_id")
      .eq("id", id)
      .single()

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting collection:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete collection" },
      { status: 500 }
    )
  }
}

