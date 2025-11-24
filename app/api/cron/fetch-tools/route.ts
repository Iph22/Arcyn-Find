import { NextResponse } from 'next/server'
import { fetchFromRSSFeeds } from '@/scripts/sources/rss-feeds'
import { fetchFromAggregators } from '@/scripts/sources/aggregators'
import { fetchFromScrapers } from '@/scripts/sources/scrapers'
import { fetchFromCommunity } from '@/scripts/sources/community'
import { deduplicateEntries, mergeEntries } from '@/scripts/utils/deduplicator'
import { getSupabaseAdmin, transformToDBRow } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import type { AIEntry } from '@/lib/ai-data'

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
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron (optional - can be enabled with CRON_SECRET env var)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
  }

  try {
    logger.log('[Cron] Starting scheduled fetch from all sources...')
    
    // Fetch from all sources
    const [rssEntries, aggregatorEntries, scraperEntries, communityEntries] = await Promise.all([
      fetchFromRSSFeeds(),
      fetchFromAggregators(),
      fetchFromScrapers(),
      fetchFromCommunity(),
    ])
    
    const allEntries = [...rssEntries, ...aggregatorEntries, ...scraperEntries, ...communityEntries]
    
    // Deduplicate and merge
    const deduplicated = deduplicateEntries(allEntries)
    const merged = mergeEntries(deduplicated)
    
    // Store in Supabase
    const { totalInserted, totalUpdated } = await storeInSupabase(merged)
    
    return createSuccessResponse({ 
      success: true, 
      message: 'Fetch completed successfully',
      stats: {
        totalFetched: allEntries.length,
        uniqueTools: merged.length,
        inserted: totalInserted,
        updated: totalUpdated
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('[Cron] Error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for Vercel Pro
