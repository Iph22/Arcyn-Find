/**
 * Recommendation cache.
 *
 * Recommendations are expensive (a model call plus retrieval, measured p50
 * ~4s) and the Gemini free tier rate-limits under burst — the 26-query eval
 * saw 12 HTTP 429s and produced real reasoning on only 50% of calls. Caching
 * addresses both: a hit costs one indexed lookup instead of a model call, and
 * it removes repeat queries from the quota budget entirely.
 *
 * Stored in search_cache, which is already keyed on query_text and already
 * holds this query's embedding and NLP parse.
 */

import { getSupabaseAdmin } from "./supabase"
import { logger } from "./logger"

/**
 * The corpus changes slowly (tools are added, not rewritten), so a long TTL is
 * safe and maximizes the quota saved. Shorten it if tool data starts changing
 * frequently — a stale recommendation is worse than a slow one.
 */
const TTL_DAYS = 7

/** Same normalization the rest of the cache layer uses, so all three cached
 *  artifacts for a query share one row. */
export function normalizeCacheKey(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, " ")
}

export async function getCachedRecommendation(query: string): Promise<unknown | null> {
    const key = normalizeCacheKey(query)
    if (!key) return null

    try {
        const supabase = getSupabaseAdmin()
        const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

        const { data, error } = await supabase
            .from("search_cache")
            .select("recommendation, recommendation_at")
            .eq("query_text", key)
            .not("recommendation", "is", null)
            .gt("recommendation_at", cutoff)
            .maybeSingle()

        if (error) {
            // A missing column means the migration hasn't run. Not fatal —
            // the caller just computes the recommendation as before.
            if (error.message?.includes("recommendation")) {
                logger.warn("[RecCache] recommendation columns missing — run add_recommendation_cache.sql")
            } else {
                logger.warn("[RecCache] lookup failed:", error.message)
            }
            return null
        }

        if (!data?.recommendation) return null

        // Fire-and-forget usage bump; never block the response on it.
        void supabase
            .from("search_cache")
            .update({ last_used_at: new Date().toISOString() })
            .eq("query_text", key)
            .then(() => undefined)

        return data.recommendation
    } catch (error) {
        logger.warn("[RecCache] lookup threw:", error)
        return null
    }
}

/**
 * Store a recommendation.
 *
 * IMPORTANT: callers must only pass NON-degraded results. Caching a
 * deterministic-fallback recommendation would pin the lower-quality version in
 * place for the full TTL — precisely the opposite of what this is for, since
 * the reason we cache is that quota exhaustion causes those fallbacks.
 */
export async function setCachedRecommendation(query: string, payload: unknown): Promise<void> {
    const key = normalizeCacheKey(query)
    if (!key) return

    try {
        const supabase = getSupabaseAdmin()
        const { error } = await supabase
            .from("search_cache")
            .upsert(
                {
                    query_text: key,
                    recommendation: payload,
                    recommendation_at: new Date().toISOString(),
                },
                { onConflict: "query_text" }
            )

        // Upsert is correct here (unlike the ai_tools backfill, where it failed
        // on NOT NULL columns): search_cache has no NOT NULL column other than
        // query_text, which is included.
        if (error) logger.warn("[RecCache] write failed:", error.message)
    } catch (error) {
        logger.warn("[RecCache] write threw:", error)
    }
}
