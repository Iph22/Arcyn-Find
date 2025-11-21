import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("collections")
      .select(
        `
        *,
        collection_items(count)
      `
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ collections: [] })
      }
      throw error
    }

    const collections = (data || []).map((col: any) => ({
      ...col,
      tool_count: col.collection_items?.[0]?.count || 0,
    }))

    return NextResponse.json({ collections })
  } catch (error: any) {
    console.error("Error fetching collections:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch collections" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, is_public = false } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("collections")
      .insert({
        user_id: user.id,
        name,
        description,
        is_public,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(
          { error: "Collections table does not exist" },
          { status: 500 }
        )
      }
      throw error
    }

    return NextResponse.json({ collection: data })
  } catch (error: any) {
    console.error("Error creating collection:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create collection" },
      { status: 500 }
    )
  }
}

