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
import {
    updateViewCountCaches,
    updateAllTrendingStats,
    cleanupOldViews
} from '@/lib/services/view-tracking.service'
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

        // 1. Update view count caches
        const viewCountResult = await updateViewCountCaches()
        logger.info(`[Cron:UpdateTrending] View counts updated: ${viewCountResult.updated}`)

        // 2. Update trending scores
        const trendingResult = await updateAllTrendingStats()
        logger.info(`[Cron:UpdateTrending] Trending scores updated: ${trendingResult.updated}`)

        // 3. Cleanup old views (every run)
        const cleanedUp = await cleanupOldViews()
        logger.info(`[Cron:UpdateTrending] Cleaned up ${cleanedUp} old view records`)

        const duration = Date.now() - startTime

        return NextResponse.json({
            success: true,
            results: {
                viewCounts: viewCountResult,
                trending: trendingResult,
                cleanedUp
            },
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
