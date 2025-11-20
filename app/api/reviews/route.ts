import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const toolId = searchParams.get('toolId')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!toolId) {
      return NextResponse.json({ error: 'toolId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get reviews
    const { data: reviews, error, count } = await supabase
      .from('tool_reviews')
      .select(
        `
        *,
        user_profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      `,
        { count: 'exact' }
      )
      .eq('tool_id', toolId)
      .order('helpful_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Get review stats
    const { data: statsData } = await supabase
      .from('tool_reviews')
      .select('rating')
      .eq('tool_id', toolId)

    const stats = {
      avg_rating: 0,
      total_reviews: statsData?.length || 0,
      rating_distribution: {} as Record<string, number>,
    }

    if (statsData && statsData.length > 0) {
      const total = statsData.length
      const avg = statsData.reduce((sum, r) => sum + r.rating, 0) / total
      stats.avg_rating = Math.round(avg * 10) / 10

      for (let i = 1; i <= 5; i++) {
        stats.rating_distribution[i.toString()] = statsData.filter(r => r.rating === i).length
      }
    }

    return NextResponse.json({
      reviews: reviews || [],
      stats,
      total: count || 0,
    })
  } catch (error: any) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}

