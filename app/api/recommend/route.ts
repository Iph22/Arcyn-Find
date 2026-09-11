import { NextResponse } from 'next/server'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { retrieveCandidates, coverageAdjustedScores, type RetrievalSource } from '@/lib/retrieval'
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
    // Real relevance signals, not constants.
    //
    // These were hardcoded to 0.5 for every candidate, which meant three of the
    // orchestrator's six scoring terms (semantic, trust, freshness) contributed
    // an identical amount to everything and only keyword overlap, intent
    // heuristics and popularity could separate candidates. Retrieval had
    // computed real vector-similarity and FTS-rank values and this route threw
    // them away — see RetrievalScores in lib/retrieval.ts.
    const rankingCandidates = candidates.map(c => ({
        id: c.id,
        title: c.name,
        description: c.description,
        platform: c.platform,
        tags: c.tags,
        // 0.5 remains the fallback for tiers that genuinely cannot compute a
        // value (FTS has no embedding distance). A missing signal must read as
        // "unknown", not as "zero relevance".
        keyword_score: c.scores?.keyword_score ?? 0.5,
        vector_score: c.scores?.vector_score ?? 0.5,
        popularity_score: Math.min(c.popularity / 100, 1),
        source_trust_score: c.scores?.source_trust_score ?? 0.5,
        freshness_date: c.scores?.freshness_date ?? null,
        is_trending: c.scores?.is_trending ?? false,
    }))
    const ranked = runSearchOrchestrator(query, rankingCandidates)

    // FILTER with the orchestrator, ORDER by the SQL relevance score.
    //
    // Measured offline against the labeled set (scripts/eval/ranking-offline.mts,
    // 26 queries, identical candidate pools, hybrid retrieval throughout):
    //
    //     constants + JS ranking (previous)            62%
    //     real scores + JS ranking                     73%
    //     SQL order alone, no filtering                77%
    //     orchestrator filter + SQL order  (this)      81%
    //
    // The orchestrator's hard filter is worth keeping — it drops stubs and
    // near-duplicates, which matters for the alternatives as much as the pick.
    // Its SCORING formula is what was losing: it re-ranked a carefully blended
    // hybrid relevance score using keyword overlap and popularity, which is how
    // "TLDR" beat "Sweep" for "find and fix bugs in my codebase".
    // Coverage-adjusted rather than the raw combined_score: while embedding
    // coverage is partial, a missing embedding must not read as zero similarity.
    // See coverageAdjustedScores — measured +4 points of precision@1.
    const sqlScoreById = coverageAdjustedScores(candidates)
    const retrievalOrder = new Map(candidates.map((c, i) => [c.id, i]))
    // `id` is optional on the orchestrator's result type, so a result without
    // one simply has no SQL score to look up and keeps its incoming position.
    const rankedResults = [...ranked.results].sort((a, b) => {
        const aScore = a.id ? sqlScoreById.get(a.id) : undefined
        const bScore = b.id ? sqlScoreById.get(b.id) : undefined
        if (typeof aScore === 'number' && typeof bScore === 'number' && aScore !== bScore) {
            return bScore - aScore
        }
        // No combined_score on the FTS tier; its rows arrive in SQL order
        // already, so fall back to that rather than to an arbitrary order.
        const aIndex = (a.id ? retrievalOrder.get(a.id) : undefined) ?? 0
        const bIndex = (b.id ? retrievalOrder.get(b.id) : undefined) ?? 0
        return aIndex - bIndex
    })

    // 4. Reasoning — bounded to the top ~6 ranked candidates, never the full pool.
    const toolsById = new Map<string, RecommendableTool>()
    for (const c of candidates) {
        toolsById.set(c.id, c)
        toolsById.set(c.name.toLowerCase(), c)
    }
    const recommendation = await generateRecommendation(query, rankedResults, toolsById)
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
