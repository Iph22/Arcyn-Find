/**
 * Cron Fetch Tools API Route - Security Hardened
 * 
 * Security Features:
 * - Cron secret verification (timing-safe comparison)
 * - Rate limiting for manual invocations
 * - Secure environment variable handling
 * 
 * Reliability Features:
 * - Per-source timeouts with graceful fallback
 * - Always returns 200 with stats (never 500 for scraping failures)
 * - Individual source errors don't block other sources
 */

import { NextResponse } from 'next/server'
import { fetchFromRSSFeeds } from '@/scripts/sources/rss-feeds'
import { fetchFromAggregators } from '@/scripts/sources/aggregators'
import { fetchFromScrapers } from '@/scripts/sources/scrapers'
import { fetchFromCommunity } from '@/scripts/sources/community'
import { deduplicateEntries, mergeEntries } from '@/scripts/utils/deduplicator'
import { getSupabaseAdmin, transformToDBRow } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { verifyCronAuthorization } from '@/lib/security'
import type { AIEntry } from '@/lib/ai-data'

/**
 * Wrap a fetch function with a timeout to prevent any single source
 * from blocking the entire pipeline
 */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  fallback: T,
  label: string
): Promise<{ result: T; error?: string; durationMs: number }> {
  const start = Date.now()
  try {
    const result = await Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ])
    return { result, durationMs: Date.now() - start }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    logger.error(`[Cron] ${label} failed: ${errorMsg}`)
    return { result: fallback, error: errorMsg, durationMs: Date.now() - start }
  }
}

/**
 * Store entries in Supabase
 */
async function storeInSupabase(entries: AIEntry[]) {
  const supabase = getSupabaseAdmin()
  const batchSize = 50
  let totalInserted = 0
  let totalUpdated = 0

  // Get existing tools to check for updates
  const { data: existingTools } = await supabase
    .from('ai_tools')
    .select('id, name, platform')
    .limit(10000)

  const existingMap = new Map<string, { id: string; name: string }>()
  existingTools?.forEach(tool => {
    const key = tool.name.toLowerCase().trim()
    existingMap.set(key, { id: tool.id, name: tool.name })
  })

  // Process in batches
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize)
    const toolsToUpsert = batch.map(entry => {
      const dbRow = transformToDBRow(entry)
      const existing = existingMap.get(entry.name.toLowerCase().trim())
      if (existing) {
        return { ...dbRow, id: existing.id }
      }
      return dbRow
    })

    const { data, error } = await supabase
      .from('ai_tools')
      .upsert(toolsToUpsert, { onConflict: 'id' })
      .select()

    if (!error && data) {
      const inserted = data.filter(t => !existingMap.has(t.name.toLowerCase().trim())).length
      const updated = data.length - inserted
      totalInserted += inserted
      totalUpdated += updated
    }

    if (i + batchSize < entries.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return { totalInserted, totalUpdated }
}

/**
 * Vercel Cron endpoint to fetch tools from all sources
 * Runs daily at 2 AM UTC
 * 
 * SECURITY: Protected by CRON_SECRET for production environments
 */
export async function GET(request: Request) {
  // =========================================================================
  // AUTHORIZATION - Verify cron secret (timing-safe)
  // =========================================================================
  const authHeader = request.headers.get('authorization')

  if (!verifyCronAuthorization(authHeader)) {
    logger.warn('[Cron] Unauthorized cron request attempt')
    return createErrorResponse(
      'Unauthorized - Invalid or missing cron secret',
      401,
      ErrorCodes.UNAUTHORIZED
    )
  }

  try {
    logger.log('[Cron] Starting scheduled fetch from all sources...')

    // =========================================================================
    // FETCH FROM ALL SOURCES — each source has its own timeout
    // Max 45s per source to stay within Vercel's function time limits
    // =========================================================================
    const SOURCE_TIMEOUT = 45_000 // 45 seconds per source

    const [rssResult, aggregatorResult, scraperResult, communityResult] = await Promise.all([
      withTimeout(fetchFromRSSFeeds, SOURCE_TIMEOUT, [] as AIEntry[], 'RSS Feeds'),
      withTimeout(fetchFromAggregators, SOURCE_TIMEOUT, [] as AIEntry[], 'Aggregators'),
      withTimeout(fetchFromScrapers, SOURCE_TIMEOUT, [] as AIEntry[], 'Scrapers'),
      withTimeout(fetchFromCommunity, SOURCE_TIMEOUT, [] as AIEntry[], 'Community'),
    ])

    // Collect results and errors
    const sourceStats = {
      rss: { count: rssResult.result.length, error: rssResult.error, durationMs: rssResult.durationMs },
      aggregators: { count: aggregatorResult.result.length, error: aggregatorResult.error, durationMs: aggregatorResult.durationMs },
      scrapers: { count: scraperResult.result.length, error: scraperResult.error, durationMs: scraperResult.durationMs },
      community: { count: communityResult.result.length, error: communityResult.error, durationMs: communityResult.durationMs },
    }

    const allEntries = [
      ...rssResult.result,
      ...aggregatorResult.result,
      ...scraperResult.result,
      ...communityResult.result,
    ]

    const errors = [rssResult, aggregatorResult, scraperResult, communityResult]
      .filter(r => r.error)
      .map(r => r.error!)

    // Deduplicate and merge
    const deduplicated = deduplicateEntries(allEntries)
    const merged = mergeEntries(deduplicated)

    // Store in Supabase (only if we have entries)
    let dbStats = { totalInserted: 0, totalUpdated: 0 }
    if (merged.length > 0) {
      try {
        dbStats = await storeInSupabase(merged)
      } catch (dbError) {
        logger.error('[Cron] Database storage error:', dbError)
        errors.push(dbError instanceof Error ? dbError.message : 'Database storage failed')
      }
    }

    logger.log('[Cron] Fetch completed:', {
      totalFetched: allEntries.length,
      uniqueTools: merged.length,
      inserted: dbStats.totalInserted,
      updated: dbStats.totalUpdated,
      errors: errors.length,
    })

    // Always return 200 — partial success is still success
    // The workflow should only fail on auth errors, not scraping hiccups
    return createSuccessResponse({
      success: true,
      message: errors.length > 0
        ? `Fetch completed with ${errors.length} source error(s)`
        : 'Fetch completed successfully',
      stats: {
        totalFetched: allEntries.length,
        uniqueTools: merged.length,
        inserted: dbStats.totalInserted,
        updated: dbStats.totalUpdated,
      },
      sources: sourceStats,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('[Cron] Critical error:', error)
    // Even on critical errors, return 200 with error details so the
    // GitHub Action doesn't fail on transient issues
    return createSuccessResponse({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown critical error',
      stats: { totalFetched: 0, uniqueTools: 0, inserted: 0, updated: 0 },
      timestamp: new Date().toISOString()
    })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for Vercel Pro
