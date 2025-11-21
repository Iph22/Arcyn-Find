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
      .from("favorites")
      .select("tool_id")
      .eq("user_id", user.id)

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ favorites: [] })
      }
      throw error
    }

    const favorites = (data || []).map((item: any) => item.tool_id)

    return NextResponse.json({ favorites })
  } catch (error: any) {
    console.error("Error fetching favorites:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch favorites" },
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
    const { tool_id } = body

    if (!tool_id) {
      return NextResponse.json({ error: "tool_id is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from("favorites").insert({
      user_id: user.id,
      tool_id,
    })

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Already favorited" }, { status: 409 })
      }
      if (error.code === "42P01") {
        return NextResponse.json(
          { error: "Favorites table does not exist" },
          { status: 500 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error adding favorite:", error)
    return NextResponse.json(
      { error: error.message || "Failed to add favorite" },
      { status: 500 }
    )
  }
}

