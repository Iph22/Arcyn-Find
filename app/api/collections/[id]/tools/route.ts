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

    const body = await request.json()
    const { tool_id } = body

    if (!tool_id) {
      return NextResponse.json({ error: "tool_id is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Verify ownership
    const { data: collection } = await supabase
      .from("collections")
      .select("user_id")
      .eq("id", id)
      .single()

    if (!collection || collection.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await supabase.from("collection_items").insert({
      collection_id: id,
      tool_id,
    })

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Tool already in collection" }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error adding tool to collection:", error)
    return NextResponse.json(
      { error: error.message || "Failed to add tool" },
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

    const searchParams = request.nextUrl.searchParams
    const tool_id = searchParams.get("tool_id")

    if (!tool_id) {
      return NextResponse.json({ error: "tool_id is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Verify ownership
    const { data: collection } = await supabase
      .from("collections")
      .select("user_id")
      .eq("id", id)
      .single()

    if (!collection || collection.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", id)
      .eq("tool_id", tool_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error removing tool from collection:", error)
    return NextResponse.json(
      { error: error.message || "Failed to remove tool" },
      { status: 500 }
    )
  }
}

