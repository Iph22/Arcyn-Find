/**
 * Enhanced View Tracking Service
 * 
 * Features:
 * - Persistent view tracking in database
 * - Rate limiting and anti-manipulation
 * - Trending score calculation
 * - View analytics
 */

import { getSupabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'

export interface ViewStats {
    totalViews: number
    views24h: number
    views7d: number
    trendingScore: number
}

/**
 * Hash IP address for privacy-safe uniqueness tracking
 */
function hashIP(ip: string): string {
    return createHash('sha256').update(ip + 'arcyn-salt').digest('hex').substring(0, 16)
}

/**
 * Track a view for a tool
 *
 * This deliberately no longer nudges `popularity`. The previous version added
 * 0.05 per view and wrote `Math.round(n * 10) / 10`, but `ai_tools.popularity`
 * is an INTEGER column, so Postgres rejected the value outright:
 *
 *   22P02 invalid input syntax for type integer: "28.1"
 *
 * Because that travelled in the same UPDATE as `view_count` and
 * `last_view_at`, the whole statement failed — and since the result was never
 * checked, the function still returned `{ success: true }`. Every view ever
 * recorded was lost this way. (Measured 2026-09-14 against the live table.)
 *
 * Restoring the boost would need a numeric column, and it is not worth one:
 * `calculateTrendingScore` already folds views in directly (80% of the score)
 * and treats `popularity` as the stable ingest-time prior contributing the
 * other 20%. Feeding views into popularity as well would count them twice.
 */
export async function trackToolView(
    toolId: string,
    options: {
        ip?: string
        sessionId?: string
        source?: string
    } = {}
): Promise<{ success: boolean; viewCount?: number }> {
    const supabase = getSupabaseAdmin()

    // Check if tool exists
    const { data: tool, error: toolError } = await supabase
        .from('ai_tools')
        .select('id, view_count')
        .eq('id', toolId)
        .single()

    if (toolError || !tool) {
        return { success: false }
    }

    // Insert view record (if tool_views table exists).
    //
    // Typed as a concrete row shape rather than Record<string, string>: an index
    // signature does not satisfy supabase-js's RejectExcessProperties<> guard on
    // .insert(), which is a compile error rather than a runtime one — it failed
    // both the type-check and build jobs in CI.
    const viewData: {
        tool_id: string
        source: string
        ip_hash?: string
        session_id?: string
    } = {
        tool_id: toolId,
        source: options.source || 'web',
    }

    if (options.ip) {
        viewData.ip_hash = hashIP(options.ip)
    }

    if (options.sessionId) {
        viewData.session_id = options.sessionId
    }

    const { error: insertError } = await supabase.from('tool_views').insert(viewData)

    if (insertError) {
        // Not fatal on its own — the counter below is what the UI reads, and the
        // 24h/7d rebuild can survive one missing row. Logged rather than
        // swallowed, because a *persistent* failure here silently starves the
        // trending calculation of its only input.
        if (insertError.message?.includes('does not exist') || insertError.code === '42P01') {
            console.warn('[ViewTracking] tool_views table does not exist. Run the add_view_tracking.sql migration.')
        } else {
            console.error('[ViewTracking] Failed to insert view row:', insertError.message)
        }
    }

    // Read-modify-write, so simultaneous views of the same tool can lose an
    // increment. Tolerated deliberately: view_count is a display figure, while
    // the numbers that drive trending (view_count_24h / view_count_7d) are
    // recounted from tool_views by the cron and are not affected by this race.
    // An atomic increment needs a Postgres function; see refreshTrendingStats.
    const viewCount = (tool.view_count || 0) + 1

    const { error: updateError } = await supabase
        .from('ai_tools')
        .update({
            view_count: viewCount,
            last_view_at: new Date().toISOString(),
        })
        .eq('id', toolId)

    if (updateError) {
        console.error('[ViewTracking] Failed to update view counters:', updateError.message)
        return { success: false }
    }

    return { success: true, viewCount }
}

/**
 * Get view stats for a tool
 */
export async function getToolViewStats(toolId: string): Promise<ViewStats | null> {
    const supabase = getSupabaseAdmin()

    try {
        const { data: tool } = await supabase
            .from('ai_tools')
            .select('view_count, view_count_24h, view_count_7d, trending_score')
            .eq('id', toolId)
            .single()

        if (!tool) return null

        return {
            totalViews: tool.view_count || 0,
            views24h: tool.view_count_24h || 0,
            views7d: tool.view_count_7d || 0,
            trendingScore: tool.trending_score || 0
        }
    } catch {
        return null
    }
}

/**
 * Calculate trending score for a tool
 * 
 * Formula:
 * - 50% from 24h views (normalized)
 * - 30% from 7d views (normalized)  
 * - 20% from overall popularity
 * - Decay factor for older last views
 */
export function calculateTrendingScore(
    views24h: number,
    views7d: number,
    popularity: number,
    lastViewAt: Date | null,
    maxViews24h: number = 100,
    maxViews7d: number = 500
): number {
    // Normalize view counts (0-100 scale)
    const normalized24h = Math.min(100, (views24h / maxViews24h) * 100)
    const normalized7d = Math.min(100, (views7d / maxViews7d) * 100)

    // Base score
    let score = (normalized24h * 0.5) + (normalized7d * 0.3) + (popularity * 0.2)

    // Apply decay if last view was old
    if (lastViewAt) {
        const hoursSinceLastView = (Date.now() - lastViewAt.getTime()) / (1000 * 60 * 60)

        if (hoursSinceLastView > 24) {
            // Decay: reduce score by 10% for each day since last view (up to 50%)
            const daysSinceLastView = hoursSinceLastView / 24
            const decayFactor = Math.max(0.5, 1 - (daysSinceLastView * 0.1))
            score *= decayFactor
        }
    }

    return Math.round(score * 10) / 10
}

export interface TrendingRefreshResult {
    scored: number
    demoted: number
    purged: number
    /** Calls made. >1 means the demotion backlog needed more than one chunk. */
    iterations: number
    /** True when the run stopped on its time budget with stale flags left. */
    backlogRemaining: boolean
    elapsedMs: number
}

/**
 * How long refreshTrendingStats may spend before giving up and leaving the rest
 * for the next run. The route allows 60s; this leaves headroom for the request,
 * the RPC round trips and the JSON response.
 */
const REFRESH_BUDGET_MS = 45_000

/** Rows demoted per statement. See the measurements in the migration: 500 takes
 *  2.1s and 1000 exceeds the statement timeout outright. */
const DEMOTE_CHUNK = 250

/**
 * Recompute trending stats.
 *
 * The previous implementation paginated the whole of ai_tools (263,548 rows,
 * 528 batches of 500) and rescored every row; measured against the live table,
 * `.range()` cost 520ms at offset 0, 5.2s at 50,000 and hit the statement
 * timeout outright at 100,000 — the deep-offset degradation in
 * docs/CORPUS_AND_CONSTRAINTS.md §6. It could not finish inside the route's 60s
 * budget and never did: the cron failed 40 runs out of 40 with 504, going back
 * at least to 2026-09-04.
 *
 * Nearly all of that work was wasted. With no views the score reduces to
 * `popularity * 0.2`, which cannot reach the 60 threshold, so a tool with no
 * views can neither become trending nor change score between runs.
 *
 * What remains is one small set-based call, looped: each RPC rescores the tools
 * that do have views and demotes one bounded chunk of the stale-flag backlog.
 * The loop is here rather than in SQL because the chunk has to stay small —
 * every row written maintains all of ai_tools' indexes including IVFFlat, and
 * a 1000-row chunk exceeds the statement timeout — while the backlog is tens of
 * thousands of rows. Many small statements inside one wall-clock budget.
 */
export async function refreshTrendingStats(options: {
    cleanupLimit?: number
    retentionDays?: number
    budgetMs?: number
} = {}): Promise<TrendingRefreshResult> {
    const supabase = getSupabaseAdmin()
    const cleanupLimit = options.cleanupLimit ?? DEMOTE_CHUNK
    const retentionDays = options.retentionDays ?? 30
    const budgetMs = options.budgetMs ?? REFRESH_BUDGET_MS

    const startedAt = Date.now()
    const total = { scored: 0, demoted: 0, purged: 0 }
    let iterations = 0
    let backlogRemaining = false

    for (;;) {
        const { data, error } = await supabase.rpc('refresh_trending_stats', {
            p_cleanup_limit: cleanupLimit,
            p_retention_days: retentionDays,
            // Scoring and purging are done once; later passes only drain the
            // demotion backlog.
            p_demote_only: iterations > 0,
        })

        if (error) {
            if (error.message?.includes('Could not find the function')) {
                throw new Error(
                    'refresh_trending_stats() is missing or has an old signature. Apply ' +
                    'supabase/migrations/add_refresh_trending_stats.sql.'
                )
            }
            // A partial run is still progress: report what landed rather than
            // discarding it, so repeated runs converge instead of restarting.
            if (iterations > 0) {
                console.error(`[Trending] stopped after ${iterations} chunks: ${error.message}`)
                backlogRemaining = true
                break
            }
            throw new Error(`refresh_trending_stats failed: ${error.message}`)
        }

        // RETURNS TABLE gives a one-row set.
        const row = Array.isArray(data) ? data[0] : data
        iterations++
        total.scored += row?.scored ?? 0
        total.demoted += row?.demoted ?? 0
        total.purged += row?.purged ?? 0

        // A short chunk means the backlog is drained.
        if ((row?.demoted ?? 0) < cleanupLimit) break

        if (Date.now() - startedAt > budgetMs) {
            backlogRemaining = true
            break
        }
    }

    return { ...total, iterations, backlogRemaining, elapsedMs: Date.now() - startedAt }
}

export interface SearchCachePruneResult {
    deletedOneShot: number
    deletedIdle: number
    clearedPayloads: number
    iterations: number
    elapsedMs: number
}

/**
 * Prune search_cache.
 *
 * search_cache had no eviction of any kind. Every row holds a vector(768)
 * (~3KB) plus cached recommendation and stack payloads, and
 * docs/CORPUS_AND_CONSTRAINTS.md §4 measured that ~76% of its rows are
 * keystroke fragments ("ai t", "ai too", "ai tool") that were never looked up
 * a second time. Those rows were permanent.
 *
 * Rides the trending cron rather than adding a schedule of its own: that
 * workflow already runs every 6 hours, already holds CRON_SECRET, and already
 * has failure alerting wired up (which it earned the hard way -- see the note
 * in .github/workflows/cron-update-trending.yml).
 *
 * Chunked for the same reason refreshTrendingStats is: §7 measured writes to
 * an indexed table as superlinear in chunk size, and this table carries four
 * indexes plus a vector column. Many small statements inside one wall clock.
 */
export async function pruneSearchCache(options: {
    deleteLimit?: number
    budgetMs?: number
} = {}): Promise<SearchCachePruneResult> {
    const supabase = getSupabaseAdmin()
    const deleteLimit = options.deleteLimit ?? 2000
    const budgetMs = options.budgetMs ?? 10_000

    const startedAt = Date.now()
    const total = { deletedOneShot: 0, deletedIdle: 0, clearedPayloads: 0 }
    let iterations = 0

    for (;;) {
        const { data, error } = await supabase.rpc('prune_search_cache', {
            p_delete_limit: deleteLimit,
        })

        if (error) {
            if (error.message?.includes('Could not find the function')) {
                throw new Error(
                    'prune_search_cache() is missing. Apply ' +
                    'supabase/migrations/add_cache_retention.sql.'
                )
            }
            // Partial progress is still progress, same as refreshTrendingStats.
            if (iterations > 0) {
                console.error(`[SearchCache] stopped after ${iterations} chunks: ${error.message}`)
                break
            }
            throw new Error(`prune_search_cache failed: ${error.message}`)
        }

        const row = Array.isArray(data) ? data[0] : data
        iterations++

        const oneShot = row?.deleted_one_shot ?? 0
        const idle = row?.deleted_idle ?? 0
        total.deletedOneShot += oneShot
        total.deletedIdle += idle
        total.clearedPayloads += row?.cleared_payloads ?? 0

        // Both deletes came back short: nothing left to remove this pass.
        if (oneShot < deleteLimit && idle < deleteLimit) break

        if (Date.now() - startedAt > budgetMs) break
    }

    return { ...total, iterations, elapsedMs: Date.now() - startedAt }
}
