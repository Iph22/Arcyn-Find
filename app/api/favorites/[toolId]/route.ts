import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const { toolId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("tool_id", toolId)

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ error: "Favorites table does not exist" }, { status: 500 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error removing favorite:", error)
    return NextResponse.json(
      { error: error.message || "Failed to remove favorite" },
      { status: 500 }
    )
  }
}

