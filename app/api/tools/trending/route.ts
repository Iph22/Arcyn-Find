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

    // Get trending tools (either marked as trending or high popularity)
    query = query
      .or('is_trending.eq.true,popularity.gte.70')
      .order('popularity', { ascending: false })
      .order('last_updated', { ascending: false })
      .limit(limit)

    const { data: tools, error } = await query

    if (error) throw error

    // Get review stats for each tool
    const toolsWithStats = await Promise.all(
      (tools || []).map(async (tool) => {
        // Get review count and average rating
        const { data: reviewStats } = await supabase
          .from('tool_reviews')
          .select('rating, helpful_count')
          .eq('tool_id', tool.id)

        const reviews = reviewStats || []
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0

        // Get favorites count
        const { count: favoritesCount } = await supabase
          .from('user_favorites')
          .select('*', { count: 'exact', head: true })
          .eq('tool_id', tool.id)

        return {
          ...tool,
          rating: Number(avgRating.toFixed(1)),
          review_count: reviews.length,
          favorites_count: favoritesCount || 0,
          users: favoritesCount ? `${favoritesCount}+` : '0'
        }
      })
    )

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
