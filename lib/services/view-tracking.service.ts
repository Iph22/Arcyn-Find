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

/** How many row updates to have in flight at once. Bounded so a large batch
 *  can't open hundreds of simultaneous connections. */
const UPDATE_CONCURRENCY = 25

/** PostgREST caps any single response at 1000 rows and does not say so
 *  (docs/CORPUS_AND_CONSTRAINTS.md §2). An unpaginated `.select()` over the
 *  view window therefore returns the first 1000 rows and every count derived
 *  from it is silently wrong — no error, just numbers that stop growing. This
 *  is the cap, so pages are requested at exactly that size. */
const VIEW_PAGE_SIZE = 1000

/** Ceiling on rows scanned per cron run, to stay inside the route's 60s
 *  maxDuration. At ~1000 rows a round trip this is tens of seconds in the worst
 *  case; reaching it is the signal to move this aggregation into SQL rather
 *  than to raise the number. */
const MAX_VIEW_ROWS_PER_RUN = 50_000

/**
 * Apply per-row partial updates with bounded concurrency.
 *
 * Why not `.upsert(rows, { onConflict: 'id' })`? Because PostgREST turns that
 * into `INSERT ... ON CONFLICT (id) DO UPDATE`, and the INSERT half has to
 * satisfy every NOT NULL column on the table. A payload carrying only the
 * columns you want to change fails outright with
 * `null value in column "name" of relation "ai_tools" violates not-null
 * constraint` — it never reaches the ON CONFLICT clause. An earlier revision
 * of this file used exactly that pattern and would have failed every batch.
 *
 * Real UPDATEs are the correct primitive here. They cost one round trip per
 * row, so they run concurrently in bounded chunks rather than sequentially —
 * the sequential version was the original problem this batching was meant to
 * solve (it blew the cron's 60s maxDuration).
 */
async function applyPartialUpdates(
    supabase: ReturnType<typeof getSupabaseAdmin>,
    rows: Array<{ id: string; values: Record<string, unknown> }>
): Promise<{ updated: number; errors: number }> {
    let updated = 0
    let errors = 0

    for (let i = 0; i < rows.length; i += UPDATE_CONCURRENCY) {
        const chunk = rows.slice(i, i + UPDATE_CONCURRENCY)
        const results = await Promise.allSettled(
            chunk.map(row =>
                supabase.from('ai_tools').update(row.values).eq('id', row.id)
            )
        )
        for (const r of results) {
            if (r.status === 'fulfilled' && !r.value.error) updated++
            else errors++
        }
    }

    return { updated, errors }
}

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
    // An atomic increment needs a Postgres function; see updateViewCountCaches.
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

/**
 * Update trending stats for all tools (called by cron)
 */
export async function updateAllTrendingStats(): Promise<{
    updated: number
    errors: number
}> {
    const supabase = getSupabaseAdmin()

    let updated = 0
    let errors = 0

    try {
        // Get max views for normalization
        const { data: maxStats } = await supabase
            .from('ai_tools')
            .select('view_count_24h, view_count_7d')
            .order('view_count_24h', { ascending: false })
            .limit(1)
            .single()

        const maxViews24h = Math.max(maxStats?.view_count_24h || 100, 100)
        const maxViews7d = Math.max(maxStats?.view_count_7d || 500, 500)

        // Fetch all tools in batches
        let offset = 0
        const batchSize = 500

        while (true) {
            const { data: tools, error } = await supabase
                .from('ai_tools')
                .select('id, view_count_24h, view_count_7d, popularity, last_view_at, is_trending')
                .range(offset, offset + batchSize - 1)

            if (error || !tools || tools.length === 0) break

            // Compute every row's new values first, then write the whole batch
            // in ONE upsert instead of one .update() round trip per tool — the
            // per-row loop was easily exceeding the cron's 60s maxDuration for
            // any table with more than a few hundred rows.
            const batchUpdates: { id: string; trending_score: number; is_trending: boolean }[] = []
            for (const tool of tools) {
                try {
                    const newScore = calculateTrendingScore(
                        tool.view_count_24h || 0,
                        tool.view_count_7d || 0,
                        tool.popularity || 50,
                        tool.last_view_at ? new Date(tool.last_view_at) : null,
                        maxViews24h,
                        maxViews7d
                    )

                    // Auto-update is_trending flag
                    const shouldBeTrending = newScore >= 60 || (tool.view_count_24h || 0) > 10

                    batchUpdates.push({ id: tool.id, trending_score: newScore, is_trending: shouldBeTrending })
                } catch {
                    errors++
                }
            }

            if (batchUpdates.length > 0) {
                const result = await applyPartialUpdates(
                    supabase,
                    batchUpdates.map(u => ({
                        id: u.id,
                        values: { trending_score: u.trending_score, is_trending: u.is_trending },
                    }))
                )
                updated += result.updated
                errors += result.errors
            }

            offset += batchSize
            if (tools.length < batchSize) break
        }
    } catch (error) {
        console.error('Error updating trending stats:', error)
    }

    return { updated, errors }
}

/**
 * Update view count caches (24h and 7d)
 * Called by cron job
 */
export async function updateViewCountCaches(): Promise<{
    updated: number
    errors: number
}> {
    const supabase = getSupabaseAdmin()

    let updated = 0
    let errors = 0

    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const counts24h: Record<string, number> = {}
    const counts7d: Record<string, number> = {}

    try {
        // One pass over the 7-day window, not two queries. The 24h window is a
        // subset, so bucketing on the timestamp gives both counts from the same
        // rows — half the round trips, and the two numbers can never disagree
        // with each other the way two independently-truncated queries could.
        //
        // Ascending order matters: tool_views is append-only, so new rows
        // arriving mid-pagination land after the cursor and cannot shift rows
        // already read. (Rows sharing a timestamp may still straddle a page
        // boundary; at one view either way that is below the noise floor of
        // what these counters drive.)
        let offset = 0
        let scanned = 0
        let truncated = false

        // Compared as epoch milliseconds, never as strings: PostgREST renders
        // timestamptz as `2026-09-14T10:00:00+00:00` while `toISOString()`
        // produces `2026-09-14T10:00:00.000Z`, and lexicographically `+` sorts
        // before `.` — a string compare would drop every 24h view.
        const yesterdayMs = yesterday.getTime()

        while (true) {
            const { data, error } = await supabase
                .from('tool_views')
                .select('tool_id, viewed_at')
                .gte('viewed_at', lastWeek.toISOString())
                .order('viewed_at', { ascending: true })
                .range(offset, offset + VIEW_PAGE_SIZE - 1)

            if (error) {
                // If tool_views table doesn't exist, skip gracefully
                if (error.message?.includes('does not exist') || error.code === '42P01') {
                    console.warn('[ViewTracking] tool_views table does not exist. Run the add_view_tracking.sql migration.')
                    return { updated: 0, errors: 0 }
                }
                // For other errors, log but don't fail completely — whatever
                // pages already came back are still worth writing.
                console.error('[ViewTracking] Error querying tool_views:', error)
                break
            }

            if (!data || data.length === 0) break

            for (const view of data) {
                counts7d[view.tool_id] = (counts7d[view.tool_id] || 0) + 1
                if (new Date(view.viewed_at).getTime() >= yesterdayMs) {
                    counts24h[view.tool_id] = (counts24h[view.tool_id] || 0) + 1
                }
            }

            scanned += data.length
            offset += VIEW_PAGE_SIZE

            if (data.length < VIEW_PAGE_SIZE) break
            if (scanned >= MAX_VIEW_ROWS_PER_RUN) {
                truncated = true
                break
            }
        }

        if (truncated) {
            // Said out loud rather than swallowed: past this point the counters
            // understate reality, and the fix is an aggregate in SQL, not a
            // bigger cap here.
            console.warn(
                `[ViewTracking] Hit the ${MAX_VIEW_ROWS_PER_RUN}-row scan cap. ` +
                'View counts for this run are an undercount — move this aggregation into a Postgres RPC.'
            )
        }

        // Update all tools with their counts — one batched upsert instead of
        // one .update() round trip per tool (could be thousands of tools).
        const allToolIds = Array.from(new Set([...Object.keys(counts24h), ...Object.keys(counts7d)]))
        const UPSERT_BATCH_SIZE = 500

        for (let i = 0; i < allToolIds.length; i += UPSERT_BATCH_SIZE) {
            const batchIds = allToolIds.slice(i, i + UPSERT_BATCH_SIZE)
            const result = await applyPartialUpdates(
                supabase,
                batchIds.map(toolId => ({
                    id: toolId,
                    values: {
                        view_count_24h: counts24h[toolId] || 0,
                        view_count_7d: counts7d[toolId] || 0,
                    },
                }))
            )
            updated += result.updated
            errors += result.errors
        }

        // Reset counts for tools with no recent views (decay)
        await supabase
            .from('ai_tools')
            .update({ view_count_24h: 0 })
            .lt('last_view_at', yesterday.toISOString())

    } catch (error) {
        console.error('Error updating view count caches:', error)
    }

    return { updated, errors }
}

/**
 * Clean up old view records (older than 30 days)
 */
export async function cleanupOldViews(): Promise<number> {
    const supabase = getSupabaseAdmin()

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    try {
        // First count how many will be deleted
        const { count, error } = await supabase
            .from('tool_views')
            .select('*', { count: 'exact', head: true })
            .lt('viewed_at', thirtyDaysAgo.toISOString())

        // If tool_views table doesn't exist, skip gracefully
        if (error) {
            if (error.message?.includes('does not exist') || error.code === '42P01') {
                return 0 // Table doesn't exist, nothing to clean
            }
            console.error('[ViewTracking] Error in cleanupOldViews:', error)
            return 0
        }

        // Then delete them
        await supabase
            .from('tool_views')
            .delete()
            .lt('viewed_at', thirtyDaysAgo.toISOString())

        return count || 0
    } catch {
        return 0
    }
}
