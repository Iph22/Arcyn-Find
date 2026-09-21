/**
 * Cron Job: Update Trending Stats
 * 
 * This cron job:
 * 1. Updates view count caches (24h, 7d)
 * 2. Recalculates trending scores for all tools
 * 3. Auto-updates is_trending flags
 * 4. Cleans up old view records (> 30 days)
 * 5. Prunes search_cache, which otherwise grows without bound
 *
 * Should run every 6 hours for timely trending updates
 */

import { NextResponse } from 'next/server'
import { refreshTrendingStats, pruneSearchCache } from '@/lib/services/view-tracking.service'
import { logger } from '@/lib/logger'

export const maxDuration = 60 // 60 seconds max
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    // Security: Check for Cron Secret
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    const authHeader = req.headers.get('authorization')

    const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-key'

    if (authHeader !== `Bearer ${CRON_SECRET}` && key !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()

    try {
        logger.info('[Cron:UpdateTrending] Starting trending stats update...')

        // Recounting views, rescoring, demoting stale flags and purging old
        // rows are one set-based call now. The previous three-step version
        // walked all 263k ai_tools rows and never once completed inside the
        // 60s budget — 40 consecutive 504s.
        const result = await refreshTrendingStats()

        logger.info(
            `[Cron:UpdateTrending] scored=${result.scored} demoted=${result.demoted} ` +
            `purged=${result.purged} chunks=${result.iterations} in ${result.elapsedMs}ms`
        )

        // Retention for search_cache, which previously had none at all.
        //
        // Attached to this cron rather than given its own schedule: it already
        // runs at the right frequency, already holds CRON_SECRET, and already
        // alerts on failure. Deliberately AFTER the trending work and inside
        // its own try/catch -- trending is what this endpoint is for, and a
        // failure to prune a cache must not turn a successful trending run
        // into a 500 that the alert treats as an outage.
        let cachePruned: Awaited<ReturnType<typeof pruneSearchCache>> | null = null
        try {
            cachePruned = await pruneSearchCache()
            logger.info(
                `[Cron:UpdateTrending] search_cache oneShot=${cachePruned.deletedOneShot} ` +
                `idle=${cachePruned.deletedIdle} payloads=${cachePruned.clearedPayloads} ` +
                `chunks=${cachePruned.iterations} in ${cachePruned.elapsedMs}ms`
            )
        } catch (pruneError) {
            logger.error('[Cron:UpdateTrending] search_cache prune failed:', pruneError)
        }

        if (result.backlogRemaining) {
            // Not an error: demotion is chunked to keep each UPDATE inside the
            // statement timeout, so a large stale-flag backlog drains over
            // several runs. Said out loud so a backlog that never shrinks is
            // visible rather than silent.
            logger.warn(
                '[Cron:UpdateTrending] stopped on the time budget with stale ' +
                'is_trending rows remaining; the next run continues from here.'
            )
        }

        const duration = Date.now() - startTime

        return NextResponse.json({
            success: true,
            results: result,
            // null when the prune failed; the log line above says why. Reported
            // rather than omitted so a prune that has silently stopped working
            // is visible in the cron output.
            searchCache: cachePruned,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        logger.error('[Cron:UpdateTrending] Error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}

// Also support POST for manual triggers
export async function POST(req: Request) {
    return GET(req)
}
