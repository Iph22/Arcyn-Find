import { NextRequest } from 'next/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * GET /api/tools/trending
 * Get trending AI tools based on favorites, reviews, and recency
 * Public endpoint - no authentication required
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '12')
    const category = searchParams.get('category')

    const supabase = getSupabaseAdmin()

    // Build query
    let query = supabase
      .from('ai_tools')
      .select(`
        id,
        name,
        description,
        category,
        platform,
        region,
        access_type,
        pricing,
        tags,
        image,
        popularity,
        is_trending,
        last_updated
      `)

    // Filter by category if provided
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    // Get trending tools:
    // 1. Manually marked as trending (is_trending = true)
    // 2. OR High popularity (popularity >= 80)
    // 3. OR Recently added/updated with good popularity (last_updated recently + popularity >= 50)

    // For "real-time" feel, we prioritize the sort by last_updated relative to popularity
    query = query
      .or('is_trending.eq.true,popularity.gte.60')
      .order('last_updated', { ascending: false }) // Show freshest first
      .order('popularity', { ascending: false })
      .limit(limit)

    const { data: tools, error } = await query

    if (error) throw error

    // Get review + favorites stats for ALL tools in 2 batched queries instead
    // of 2 queries per tool (was up to 2*limit round trips on a hot public route).
    const toolIds = (tools || []).map((t) => t.id)

    const [reviewRowsResult, favoriteRowsResult] = await Promise.all([
      toolIds.length > 0
        ? supabase.from('tool_reviews').select('tool_id, rating').in('tool_id', toolIds)
        : Promise.resolve({ data: [] as { tool_id: string; rating: number }[] }),
      toolIds.length > 0
        ? supabase.from('user_favorites').select('tool_id').in('tool_id', toolIds)
        : Promise.resolve({ data: [] as { tool_id: string }[] }),
    ])

    const reviewsByTool = new Map<string, number[]>()
    for (const row of reviewRowsResult.data || []) {
      const arr = reviewsByTool.get(row.tool_id) || []
      arr.push(row.rating)
      reviewsByTool.set(row.tool_id, arr)
    }

    const favoritesCountByTool = new Map<string, number>()
    for (const row of favoriteRowsResult.data || []) {
      favoritesCountByTool.set(row.tool_id, (favoritesCountByTool.get(row.tool_id) || 0) + 1)
    }

    const toolsWithStats = (tools || []).map((tool) => {
      const ratings = reviewsByTool.get(tool.id) || []
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0
      const favoritesCount = favoritesCountByTool.get(tool.id) || 0

      return {
        ...tool,
        rating: Number(avgRating.toFixed(1)),
        review_count: ratings.length,
        favorites_count: favoritesCount,
        users: favoritesCount ? `${favoritesCount}+` : '0'
      }
    })

    // Sort by combined score (popularity + rating + favorites)
    const sortedTools = toolsWithStats.sort((a, b) => {
      const scoreA = (a.popularity || 0) + (a.rating * 10) + (a.favorites_count * 2)
      const scoreB = (b.popularity || 0) + (b.rating * 10) + (b.favorites_count * 2)
      return scoreB - scoreA
    })

    return createSuccessResponse({ tools: sortedTools })
  } catch (error) {
    logger.error('Error fetching trending tools:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch trending tools',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
