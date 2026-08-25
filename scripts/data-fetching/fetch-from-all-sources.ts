#!/usr/bin/env node

/**
 * Main orchestrator script to fetch AI tools from all sources
 * Combines RSS feeds, aggregators, scrapers, community sources,
 * news sources, Product Hunt, and curated popular tools
 */

import { fetchFromRSSFeeds } from '../sources/rss-feeds'
import { fetchFromAggregators } from '../sources/aggregators'
import { fetchFromScrapers } from '../sources/scrapers'
import { fetchFromCommunity } from '../sources/community'
import { fetchFromNewsSources } from '../sources/news-sources'
import { fetchFromProductHunt } from '../sources/product-hunt'
import { fetchFromCuratedList } from '../sources/curated-tools'
import { deduplicateEntries, mergeEntries } from '../utils/deduplicator'
import { getSupabaseAdmin, transformToDBRow } from '../../lib/supabase'
import type { AIEntry } from '../../lib/ai-data'

/**
 * Main function to fetch from all sources and store in Supabase
 */
async function fetchFromAllSources() {
  console.log('🚀 Starting comprehensive AI tools fetch from all sources...\n')
  console.log('=' .repeat(60))
  
  const startTime = Date.now()
  const allEntries: AIEntry[] = []
  const phaseResults: { phase: string; count: number }[] = []
  
  try {
    // Phase 1: RSS Feeds
    console.log('\n📰 Phase 1: RSS Feeds')
    const rssEntries = await fetchFromRSSFeeds()
    allEntries.push(...rssEntries)
    phaseResults.push({ phase: 'RSS Feeds', count: rssEntries.length })
    console.log(`   ✓ Found ${rssEntries.length} tools from RSS feeds`)
    
    // Phase 2: Aggregators (TAAFT, Futurepedia, Toolify)
    console.log('\n🔍 Phase 2: Aggregators (TAAFT, Futurepedia, Toolify)')
    const aggregatorEntries = await fetchFromAggregators()
    allEntries.push(...aggregatorEntries)
    phaseResults.push({ phase: 'Aggregators', count: aggregatorEntries.length })
    console.log(`   ✓ Found ${aggregatorEntries.length} tools from aggregators`)
    
    // Phase 3: Scrapers (TopAI.tools, AI directories)
    console.log('\n🕷️  Phase 3: Web Scrapers')
    const scraperEntries = await fetchFromScrapers()
    allEntries.push(...scraperEntries)
    phaseResults.push({ phase: 'Scrapers', count: scraperEntries.length })
    console.log(`   ✓ Found ${scraperEntries.length} tools from scrapers`)
    
    // Phase 4: Community Sources (Reddit, HackerNoon)
    console.log('\n👥 Phase 4: Community Sources')
    const communityEntries = await fetchFromCommunity()
    allEntries.push(...communityEntries)
    phaseResults.push({ phase: 'Community', count: communityEntries.length })
    console.log(`   ✓ Found ${communityEntries.length} tools from community sources`)
    
    // Phase 5: News Sources (Blogs, Newsletters, News Sites)
    console.log('\n📰 Phase 5: News Sources')
    const newsEntries = await fetchFromNewsSources()
    allEntries.push(...newsEntries)
    phaseResults.push({ phase: 'News', count: newsEntries.length })
    console.log(`   ✓ Found ${newsEntries.length} tools from news sources`)
    
    // Phase 6: Product Hunt (GraphQL API + RSS fallback)
    console.log('\n🚀 Phase 6: Product Hunt')
    const phEntries = await fetchFromProductHunt()
    allEntries.push(...phEntries)
    phaseResults.push({ phase: 'Product Hunt', count: phEntries.length })
    console.log(`   ✓ Found ${phEntries.length} tools from Product Hunt`)
    
    // Phase 7: Curated Popular Tools (guaranteed quality baseline)
    console.log('\n📋 Phase 7: Curated Popular Tools')
    const curatedEntries = await fetchFromCuratedList()
    allEntries.push(...curatedEntries)
    phaseResults.push({ phase: 'Curated', count: curatedEntries.length })
    console.log(`   ✓ Found ${curatedEntries.length} tools from curated list`)
    
    console.log('\n' + '='.repeat(60))
    console.log(`\n📊 Total tools fetched: ${allEntries.length}`)
    console.log('\n📈 Breakdown by source:')
    for (const result of phaseResults) {
      console.log(`   ${result.phase}: ${result.count}`)
    }
    
    // Deduplicate and merge
    console.log('\n🔄 Deduplicating and merging entries...')
    const deduplicated = deduplicateEntries(allEntries)
    const merged = mergeEntries(deduplicated)
    console.log(`   ✓ After deduplication: ${merged.length} unique tools`)
    
    // Store in Supabase
    if (merged.length > 0) {
      console.log('\n💾 Storing tools in Supabase...')
      await storeInSupabase(merged)
    } else {
      console.log('\n⚠️  No tools to store')
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n✅ Process complete in ${duration}s`)
    console.log(`   Total unique tools: ${merged.length}`)
    
  } catch (error: any) {
    console.error('\n❌ Error in fetch process:', error.message)
    console.error(error.stack)
    process.exit(1)
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
  let totalErrors = 0
  
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
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(entries.length / batchSize)
    
    const toolsToUpsert = batch.map(entry => {
      const dbRow = transformToDBRow(entry)
      // Check if tool already exists
      const existing = existingMap.get(entry.name.toLowerCase().trim())
      if (existing) {
        // Update existing
        return { ...dbRow, id: existing.id }
      }
      return dbRow
    })
    
    try {
      const { data, error } = await supabase
        .from('ai_tools')
        .upsert(toolsToUpsert, { onConflict: 'id' })
        .select()
      
      if (error) {
        console.error(`   ❌ Batch ${batchNum}/${totalBatches} error:`, error.message)
        totalErrors += batch.length
      } else {
        const inserted = data?.filter(t => !existingMap.has(t.name.toLowerCase().trim())).length || 0
        const updated = (data?.length || 0) - inserted
        totalInserted += inserted
        totalUpdated += updated
        console.log(`   ✓ Batch ${batchNum}/${totalBatches}: ${inserted} inserted, ${updated} updated`)
      }
    } catch (error: any) {
      console.error(`   ❌ Batch ${batchNum}/${totalBatches} exception:`, error.message)
      totalErrors += batch.length
    }
    
    // Small delay between batches to avoid overwhelming Supabase
    if (i + batchSize < entries.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  console.log(`\n📈 Summary:`)
  console.log(`   ✓ Inserted: ${totalInserted}`)
  console.log(`   ✓ Updated: ${totalUpdated}`)
  if (totalErrors > 0) {
    console.log(`   ⚠️  Errors: ${totalErrors}`)
  }
}

// Run if executed directly
if (require.main === module) {
  fetchFromAllSources()
    .then(() => {
      console.log('\n✨ Done!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error)
      process.exit(1)
    })
}

export { fetchFromAllSources }

