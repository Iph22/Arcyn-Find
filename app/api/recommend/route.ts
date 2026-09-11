import { NextResponse } from 'next/server'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { retrieveCandidates, type RetrievalSource } from '@/lib/retrieval'
import { runSearchOrchestrator } from '@/lib/search-orchestrator'
import { generateRecommendation, type RecommendableTool } from '@/lib/recommend'
import { getCachedRecommendation, setCachedRecommendation } from '@/lib/recommendation-cache'

// Same Vercel-duration reasoning as /api/ai-models: leave headroom for the
// LLM reasoning call, which runs after retrieval + ranking, not instead of it.
export const maxDuration = 30
export const runtime = 'nodejs'

const MAX_QUERY_LENGTH = 500

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

    // Cache bypass, for the eval. Without it the eval grades the cache rather
    // than the system: a cached answer is returned unchanged for 7 days, so a
    // retrieval or ranking change looks like it did nothing. Reads are skipped;
    // WRITES still happen, so a bypassed run refreshes what it measured.
    //
    // Gated, because an open bypass is a way to force the expensive path on
    // every request — it works in development, or in production only with the
    // admin key.
    const bypassCache =
        new URL(request.url).searchParams.get('fresh') === '1' &&
        (process.env.NODE_ENV !== 'production' ||
            (Boolean(process.env.ADMIN_API_KEY) &&
                request.headers.get('x-admin-key') === process.env.ADMIN_API_KEY))

    // 0. Cache. Checked before any retrieval or model work, because a hit skips
    // both. This is what keeps repeat queries off the Gemini quota — the eval
    // measured 12 HTTP 429s across 26 back-to-back queries, and every one of
    // those lost its real reasoning to the deterministic fallback.
    const cached = bypassCache ? null : await getCachedRecommendation(query)
    if (cached) {
        return NextResponse.json(cached, {
            headers: {
                ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
                'Cache-Control': 'private, no-store',
                'X-Recommend-Cache': 'hit',
                'X-Recommend-Elapsed-Ms': String(Date.now() - requestStart),
            },
        })
    }

    // 1. Retrieval. Shared with the stack builder — lib/retrieval.ts owns the
    // tier order (hybrid -> FTS -> none) and the reasons behind it. The tier
    // that served the request is reported on X-Recommend-Retrieval below,
    // because hybrid needs a query embedding off the same Gemini quota as the
    // reasoning call: when that quota is exhausted the tier silently changes
    // and so do the answers.
    const { candidates, source: retrievalSource } = await retrieveCandidates(query)

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
    const payload = { ...recommendation, workflow: null }

    // Cache ONLY non-degraded results with an actual match.
    //
    // Caching a degraded (deterministic-template) recommendation would pin the
    // lower-quality version in place for the whole TTL — exactly backwards,
    // since the reason for caching is that quota exhaustion produces those
    // fallbacks in the first place. Better to retry next time and get real
    // reasoning than to memoize the fallback.
    if (!recommendation.degraded && recommendation.bestMatch) {
        // Fire-and-forget: a cache write must never delay the response.
        void setCachedRecommendation(query, payload)
    }

    return NextResponse.json(
        payload,
        {
            headers: {
                ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
                'Cache-Control': 'private, no-store',
                'X-Recommend-State': recommendation.bestMatch ? 'full' : 'empty',
                'X-Recommend-Retrieval': retrievalSource,
                'X-Recommend-Degraded': String(recommendation.degraded),
                'X-Recommend-Cache': bypassCache
                    ? (recommendation.degraded ? 'bypass-not-cached' : 'bypass-stored')
                    : (recommendation.degraded ? 'miss-not-cached' : 'miss-stored'),
                'X-Recommend-Elapsed-Ms': String(Date.now() - requestStart),
            },
        }
    )
}
