import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

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

    // Handle table not existing gracefully
    if (error) {
      if (error.code === '42P01' || (typeof error.message === 'string' && error.message.includes('does not exist'))) {
        // Table doesn't exist - return empty results
        return NextResponse.json({
          reviews: [],
          stats: {
            avg_rating: 0,
            total_reviews: 0,
            rating_distribution: {},
          },
          total: 0,
        })
      }
      throw error
    }

    // Get review stats
    const { data: statsData, error: statsError } = await supabase
      .from('tool_reviews')
      .select('rating')
      .eq('tool_id', toolId)

    // Handle stats error gracefully
    if (statsError && statsError.code !== '42P01' && !(typeof statsError.message === 'string' && statsError.message.includes('does not exist'))) {
      console.error('Error fetching review stats:', statsError)
    }

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

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tool_id, rating, comment } = body

    if (!tool_id || !rating) {
      return NextResponse.json(
        { error: 'tool_id and rating are required' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Check if user already reviewed this tool
    const { data: existing } = await supabase
      .from('tool_reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('tool_id', tool_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'You have already reviewed this tool' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('tool_reviews')
      .insert({
        user_id: user.id,
        tool_id,
        rating,
        comment: comment || '',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Reviews table does not exist' },
          { status: 500 }
        )
      }
      throw error
    }

    return NextResponse.json({ review: data })
  } catch (error: any) {
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create review' },
      { status: 500 }
    )
  }
}

