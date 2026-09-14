/**
 * Cron Job: Update Trending Stats
 * 
 * This cron job:
 * 1. Updates view count caches (24h, 7d)
 * 2. Recalculates trending scores for all tools
 * 3. Auto-updates is_trending flags
 * 4. Cleans up old view records (> 30 days)
 * 
 * Should run every 6 hours for timely trending updates
 */

import { NextResponse } from 'next/server'
import { refreshTrendingStats } from '@/lib/services/view-tracking.service'
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
