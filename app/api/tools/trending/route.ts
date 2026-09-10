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
        priority,
        is_trending,
        last_updated
      `)

    // Filter by category if provided
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    // ========================================================================
    // Trending selection. The previous version was
    //     .or('is_trending.eq.true,popularity.gte.60')
    //     .order('last_updated' desc).order('popularity' desc)
    // which surfaced, measured on the live corpus:
    //     tensorflow, dify, dify, ComfyUI, deer-flow, netdata, gpt4free,
    //     system_prompts_leaks, gpt4free, private-gpt, private-gpt, airflow
    // — 9 distinct tools out of 12, zero with images, and almost all
    // GitHub-scraped developer repos rather than products a user can sign up
    // for. `system_prompts_leaks` on the homepage is actively bad.
    //
    // Three things were wrong:
    //
    //  1. `is_trending` carries no signal: it is true for 63,588 of 257,692
    //     rows (~25% of the catalog). Filtering on it excludes nothing.
    //  2. Ordering by `last_updated` is arbitrary here — the ingest cron
    //     bulk-writes it, so essentially every candidate shares today's date
    //     and the sort collapses to the popularity tiebreak anyway.
    //  3. `trending_score` / `view_count_*`, which the view-tracking cron is
    //     supposed to maintain and which would be the *real* signal, are NULL
    //     for every row — that job has never completed successfully. Until it
    //     has, there is no genuine engagement signal to rank on (the whole
    //     corpus has 7 reviews and 9 favourites).
    //
    // So rank on what actually exists and is trustworthy: require an image,
    // then order by popularity and curation priority. Requiring an image is
    // the highest-leverage filter — scraped repo rows have none while curated
    // entries do, so it simultaneously fixes visual quality and excludes the
    // developer-repo noise. Measured, the same query with that one filter
    // returns Cursor, Replit Ghostwriter, Khanmigo, Cohere, Leonardo.ai,
    // Play.ht, Looka — 14/14 distinct, all presentable.
    //
    // Revisit this once the trending cron populates trending_score; at that
    // point real view velocity should lead the ordering.
    // ========================================================================
    query = query
      .not('image', 'is', null)
      .neq('image', '')
      .order('popularity', { ascending: false })
      .order('priority', { ascending: false, nullsFirst: false })
      // Over-fetch so the name-dedup below can drop duplicates without
      // shrinking the section. The corpus carries a lot of same-name rows.
      .limit(limit * 3)

    const { data: rawTools, error } = await query

    if (error) throw error

    // Collapse duplicate products, keeping the first (highest-ranked) of each.
    // Needed because the corpus has ~250 duplicated names per 1000 rows, so
    // without this the section showed the same tool two and three times.
    const seenNames = new Set<string>()
    const tools = (rawTools || []).filter((t) => {
      const key = (t.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!key || seenNames.has(key)) return false
      seenNames.add(key)
      return true
    }).slice(0, limit)

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
