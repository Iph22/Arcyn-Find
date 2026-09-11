/**
 * Stack cache.
 *
 * Stacks are the most expensive thing this app computes: one model call to
 * decompose the goal plus one retrieval per step. The Gemini quota has been the
 * binding constraint throughout Phase 2 and 3 — the eval has been reporting
 * `reasoned 0%` on the recommendation path for most of that work — so a stack
 * that has already been built must never be rebuilt just because someone
 * searched the same goal again.
 *
 * Stored on search_cache alongside the query's embedding, NLP parse and
 * recommendation, keyed by the same normalized query so all four cached
 * artifacts for a goal live in one row.
 */

import { getSupabaseAdmin } from "./supabase"
import { normalizeCacheKey } from "./recommendation-cache"
import { logger } from "./logger"
import type { Stack } from "./stack"

/**
 * Shorter than the recommendation TTL (7 days).
 *
 * A stack is a composition of several tools, so it has several times the
 * chance of containing something that has since changed its pricing or been
 * abandoned — and unlike a single recommendation, one stale member makes the
 * whole plan wrong.
 */
const TTL_DAYS = 3

export async function getCachedStack(goal: string): Promise<Stack | null> {
    const key = normalizeCacheKey(goal)
    if (!key) return null

    try {
        const supabase = getSupabaseAdmin()
        const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

        const { data, error } = await supabase
            .from("search_cache")
            .select("stack, stack_at")
            .eq("query_text", key)
            .not("stack", "is", null)
            .gt("stack_at", cutoff)
            .maybeSingle()

        if (error) {
            // A missing column means add_stack_cache.sql hasn't run. Not fatal:
            // the caller just builds the stack as if there were no cache.
            if (error.message?.includes("stack")) {
                logger.warn("[StackCache] stack columns missing — run add_stack_cache.sql")
            } else {
                logger.warn("[StackCache] lookup failed:", error.message)
            }
            return null
        }

        if (!data?.stack) return null

        void supabase
            .from("search_cache")
            .update({ last_used_at: new Date().toISOString() })
            .eq("query_text", key)
            .then(() => undefined)

        return data.stack as Stack
    } catch (error) {
        logger.warn("[StackCache] lookup threw:", error)
        return null
    }
}

/**
 * Store a stack.
 *
 * Callers must only pass non-degraded stacks with at least one filled step —
 * caching a "temporarily unavailable" result would pin it in place for the full
 * TTL, which is the exact opposite of the point, since quota exhaustion is what
 * produces those results.
 */
export async function setCachedStack(goal: string, stack: Stack): Promise<void> {
    const key = normalizeCacheKey(goal)
    if (!key) return

    try {
        const supabase = getSupabaseAdmin()
        const { error } = await supabase
            .from("search_cache")
            .upsert(
                {
                    query_text: key,
                    stack,
                    stack_at: new Date().toISOString(),
                },
                { onConflict: "query_text" }
            )

        // Upsert is safe here: search_cache has no NOT NULL column other than
        // query_text, which is included. (This is the trap that broke the
        // ai_tools pricing backfill — that table has several.)
        if (error) logger.warn("[StackCache] write failed:", error.message)
    } catch (error) {
        logger.warn("[StackCache] write threw:", error)
    }
}
