import { NextResponse } from 'next/server'
import { getSupabaseAdmin, AI_TOOLS_COLUMNS } from '@/lib/supabase'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { hybridSearch, isSemanticSearchAvailable } from '@/lib/embeddings'
import { processSearchQuery } from '@/lib/search-utils'
import { runSearchOrchestrator } from '@/lib/search-orchestrator'
import { generateRecommendation, type RecommendableTool } from '@/lib/recommend'

// Same Vercel-duration reasoning as /api/ai-models: leave headroom for the
// LLM reasoning call, which runs after retrieval + ranking, not instead of it.
export const maxDuration = 30
export const runtime = 'nodejs'

const MAX_QUERY_LENGTH = 500

interface ToolRow {
    id: string
    name: string
    category: string
    description: string | null
    platform: string
    access_type: string
    pricing: string | null
    tags: string[] | null
    popularity: number | null
}

function toRecommendable(row: ToolRow): RecommendableTool {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description || '',
        platform: row.platform,
        pricing: row.pricing || '',
        accessType: row.access_type || 'Freemium',
        tags: row.tags || [],
        popularity: row.popularity || 0,
    }
}

/**
 * POST /api/recommend
 * Phase 1 "Decide" endpoint: given a goal-shaped query, retrieve + rank
 * candidates against the existing corpus (same infra as /api/ai-models —
 * never re-implemented here), then produce ONE explained recommendation
 * (best match + up to 3 labeled alternatives) instead of a results list.
 *
 * Deliberately does not re-run /api/ai-models's NLP-intent-parsing or
 * self-healing-discovery stages — this is a focused vertical slice over the
 * existing candidate pool, not a second copy of the whole search pipeline.
 */
export async function POST(request: Request) {
    const requestStart = Date.now()

    const rateLimit = checkRateLimit(request, {
        windowMs: 60 * 1000,
        maxRequests: 30, // reasoning calls are more expensive than plain search — tighter limit
    })
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again shortly.' },
            { status: 429, headers: getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime) }
        )
    }

    let query: string
    try {
        const body = await request.json()
        query = typeof body?.query === 'string' ? body.query.trim() : ''
    } catch {
        return NextResponse.json({ error: 'Invalid request body — expected JSON with a "query" string.' }, { status: 400 })
    }

    if (!query) {
        return NextResponse.json({ error: 'query is required.' }, { status: 400 })
    }
    if (query.length > MAX_QUERY_LENGTH) {
        return NextResponse.json({ error: `query must be ${MAX_QUERY_LENGTH} characters or fewer.` }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    let candidates: RecommendableTool[] = []
    let retrievalSource: 'hybrid' | 'traditional' | 'none' = 'none'

    // 1. Retrieval — reuse the same hybridSearch used by /api/ai-models. It's
    // already tagged (ok/error) from the earlier search-pipeline fixes, so a
    // DB/RPC error here falls straight through to the traditional path below
    // rather than surfacing as a 500.
    try {
        if (await isSemanticSearchAvailable()) {
            const processed = processSearchQuery(query)
            const hybridResponse = await hybridSearch(query, 30, 0.20, processed.expanded)
            if (hybridResponse.status === 'ok' && hybridResponse.results.length > 0) {
                candidates = hybridResponse.results.map(r => ({
                    id: r.id,
                    name: r.title,
                    category: r.category,
                    description: r.description || '',
                    platform: r.platform,
                    pricing: r.pricing || '',
                    accessType: r.access_type || 'Freemium',
                    tags: r.tags || [],
                    popularity: r.popularity || 0,
                }))
                retrievalSource = 'hybrid'
            } else if (hybridResponse.status === 'error') {
                logger.warn(`[Recommend] hybridSearch degraded (${hybridResponse.errorReason}) — falling back to traditional retrieval`)
            }
        }
    } catch (error) {
        logger.warn('[Recommend] Semantic retrieval unavailable:', error)
    }

    // 2. Traditional fallback — full-text search, NOT ILIKE. An ILIKE OR-chain
    // over name/description takes 8.5s-to-timeout on this table even with
    // trigram indexes (see the note in
    // supabase/migrations/fix_advanced_search_bounded_retrieval.sql); FTS over
    // ai_tools_fts_idx does the same job in well under 2s.
    if (candidates.length === 0) {
        try {
            const processed = processSearchQuery(query)
            const terms = processed.expanded.length > 0 ? processed.expanded : [query]
            const sanitized = terms
                .map(term => term.replace(/[^\w\s-]/g, ' ').trim())
                .filter(Boolean)
                .join(' | ')

            const { data, error } = await supabase
                .from('ai_tools')
                .select(AI_TOOLS_COLUMNS)
                .textSearch('fts_vector', sanitized || query.replace(/[^\w\s-]/g, ' ').trim(), { config: 'english' })
                .order('priority', { ascending: false, nullsFirst: false })
                .order('popularity', { ascending: false })
                .limit(30)

            if (error) {
                logger.error('[Recommend] Traditional retrieval error:', error)
            } else if (data) {
                candidates = (data as unknown as ToolRow[]).map(toRecommendable)
                retrievalSource = 'traditional'
            }
        } catch (error) {
            logger.error('[Recommend] Traditional retrieval failed:', error)
        }
    }

    if (candidates.length === 0) {
        return NextResponse.json(
            {
                query,
                bestMatch: null,
                alternatives: [],
                degraded: false,
                message: "We couldn't find enough relevant tools to build a recommendation for this goal yet.",
            },
            {
                headers: {
                    ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
                    'X-Recommend-State': 'empty',
                    'X-Recommend-Elapsed-Ms': String(Date.now() - requestStart),
                },
            }
        )
    }

    // 3. Ordering — the DETERMINISTIC orchestrator, not the AI ranking pipeline.
    //
    // This is a measured tradeoff, not an oversight. A structured-output call to
    // gemini-2.5-flash costs ~11s. Two of them (rank + reason) blew the request
    // budget outright — an earlier build of this route took 41s and returned a
    // degraded result because both calls hit their timeouts. Only one fits.
    //
    // Reasoning is the one worth keeping: it produces the explanation the user
    // reads, and it can't be replicated locally. Ranking can — the deterministic
    // orchestrator scores on the same signals (keyword, vector, popularity,
    // trust, freshness, intent) and has ordered these candidates correctly
    // throughout testing. So ordering stays local and the latency budget goes to
    // the reasoning call.
    const rankingCandidates = candidates.map(c => ({
        id: c.id,
        title: c.name,
        description: c.description,
        platform: c.platform,
        tags: c.tags,
        keyword_score: 0.5,
        vector_score: 0.5,
        popularity_score: Math.min(c.popularity / 100, 1),
        source_trust_score: 0.5,
        freshness_date: null,
        is_trending: false,
    }))
    const ranked = runSearchOrchestrator(query, rankingCandidates)

    // 4. Reasoning — bounded to the top ~6 ranked candidates, never the full pool.
    const toolsById = new Map<string, RecommendableTool>()
    for (const c of candidates) {
        toolsById.set(c.id, c)
        toolsById.set(c.name.toLowerCase(), c)
    }
    const recommendation = await generateRecommendation(query, ranked.results, toolsById)

    return NextResponse.json(
        { ...recommendation, workflow: null },
        {
            headers: {
                ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
                'Cache-Control': 'private, no-store',
                'X-Recommend-State': recommendation.bestMatch ? 'full' : 'empty',
                'X-Recommend-Retrieval': retrievalSource,
                'X-Recommend-Degraded': String(recommendation.degraded),
                'X-Recommend-Elapsed-Ms': String(Date.now() - requestStart),
            },
        }
    )
}
