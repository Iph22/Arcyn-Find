/**
 * Phase 2: Aggregator APIs and Scrapers
 * Fetches from AI tool aggregator websites
 */

import * as cheerio from 'cheerio'
import type { AIEntry } from '../../lib/ai-data'
import { mapCategory, determineAccessType, determineRegion, generateId, extractTags, cleanDescription, normalizePopularity } from '../utils/transformer'
import { rateLimiter } from '../utils/rate-limiter'

/**
 * Safe fetch with retry logic
 */
async function safeFetch(url: string, retries = 3): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000), // 15 second timeout
      })
      
      if (response.ok) {
        return response
      }
    } catch (error: any) {
      if (i === retries - 1) {
        console.error(`[Aggregators] Failed to fetch ${url} after ${retries} attempts:`, error.message)
        return null
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))) // Exponential backoff
    }
  }
  return null
}

/**
 * Fetch from "There's An AI For That"
 * Note: This site may require API access or have anti-scraping measures
 */
async function fetchFromTheresAnAIForThat(): Promise<AIEntry[]> {
  const entries: AIEntry[] = []
  
  try {
    await rateLimiter.wait('theresanaiforthat', 3000)
    
    // Try to find their API endpoint or scrape their tools page
    const url = 'https://theresanaiforthat.com/'
    const response = await safeFetch(url)
    
    if (!response) {
      console.warn('[Aggregators] Could not fetch from There\'s An AI For That')
      return []
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Look for tool listings (structure may vary)
    $('.tool-item, .ai-tool, [data-tool]').each((index, element) => {
      const $el = $(element)
      const name = $el.find('h2, h3, .tool-name, [data-name]').first().text().trim()
      const description = $el.find('.description, .tool-description, p').first().text().trim()
      const link = $el.find('a').first().attr('href') || ''
      const category = $el.find('.category, [data-category]').first().text().trim()
      
      if (name && name.length > 0) {
        entries.push({
          id: generateId(name, 'theresanaiforthat', index),
          name: name.substring(0, 100),
          category: mapCategory(category),
          description: cleanDescription(description || name, 300),
          platform: link.startsWith('http') ? link : `https://theresanaiforthat.com${link}`,
          region: determineRegion(link),
          accessType: determineAccessType(),
          pricing: 'Unknown',
          tags: extractTags(description, category, name),
          popularity: normalizePopularity(60),
          lastUpdated: new Date().toISOString().split('T')[0],
          isTrending: false
        })
      }
    })
    
    console.log(`[Aggregators] Fetched ${entries.length} tools from There's An AI For That`)
  } catch (error: any) {
    console.error('[Aggregators] Error fetching from There\'s An AI For That:', error.message)
  }
  
  return entries
}

/**
 * Fetch from Futurepedia
 */
async function fetchFromFuturepedia(): Promise<AIEntry[]> {
  const entries: AIEntry[] = []
  
  try {
    await rateLimiter.wait('futurepedia', 3000)
    
    // Futurepedia tools listing page
    const url = 'https://www.futurepedia.io/ai-tools'
    const response = await safeFetch(url)
    
    if (!response) {
      console.warn('[Aggregators] Could not fetch from Futurepedia')
      return []
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Look for tool cards/items
    $('.tool-card, .ai-tool-card, [class*="tool"]').each((index, element) => {
      const $el = $(element)
      const name = $el.find('h2, h3, .tool-title, [data-tool-name]').first().text().trim()
      const description = $el.find('.description, .tool-description, p').first().text().trim()
      const link = $el.find('a').first().attr('href') || ''
      const category = $el.find('.category, .tag, [data-category]').first().text().trim()
      const pricing = $el.find('.pricing, [data-pricing]').first().text().trim()
      
      if (name && name.length > 0) {
        entries.push({
          id: generateId(name, 'futurepedia', index),
          name: name.substring(0, 100),
          category: mapCategory(category),
          description: cleanDescription(description || name, 300),
          platform: link.startsWith('http') ? link : `https://www.futurepedia.io${link}`,
          region: determineRegion(link),
          accessType: determineAccessType(pricing),
          pricing: pricing || 'Unknown',
          tags: extractTags(description, category, name),
          popularity: normalizePopularity(65),
          lastUpdated: new Date().toISOString().split('T')[0],
          isTrending: false
        })
      }
    })
    
    console.log(`[Aggregators] Fetched ${entries.length} tools from Futurepedia`)
  } catch (error: any) {
    console.error('[Aggregators] Error fetching from Futurepedia:', error.message)
  }
  
  return entries
}

/**
 * Fetch from all aggregators
 */
export async function fetchFromAggregators(): Promise<AIEntry[]> {
  console.log('\n🔍 Phase 2: Fetching from aggregators...\n')
  
  const allEntries: AIEntry[] = []
  
  // Fetch from aggregators in parallel (with rate limiting)
  const results = await Promise.allSettled([
    fetchFromTheresAnAIForThat(),
    fetchFromFuturepedia(),
  ])
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEntries.push(...result.value)
    } else {
      console.error('[Aggregators] Error:', result.reason)
    }
  }
  
  console.log(`\n✅ Phase 2 complete: Found ${allEntries.length} tools from aggregators\n`)
  return allEntries
}

