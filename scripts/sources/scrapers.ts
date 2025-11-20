/**
 * Phase 3: Web Scrapers
 * Scrapes AI tool directories and aggregator sites
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
        signal: AbortSignal.timeout(15000),
      })
      
      if (response.ok) {
        return response
      }
    } catch (error: any) {
      if (i === retries - 1) {
        console.error(`[Scrapers] Failed to fetch ${url} after ${retries} attempts:`, error.message)
        return null
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  return null
}

/**
 * Fetch from AITopTools
 */
async function fetchFromAITopTools(): Promise<AIEntry[]> {
  const entries: AIEntry[] = []
  
  try {
    await rateLimiter.wait('aitoptools', 3000)
    
    // Try multiple pages
    for (let page = 1; page <= 3; page++) {
      const url = `https://aitoptools.com/page/${page}`
      const response = await safeFetch(url)
      
      if (!response) break
      
      const html = await response.text()
      const $ = cheerio.load(html)
      
      $('.tool-item, .ai-tool, article, [class*="tool"]').each((index, element) => {
        const $el = $(element)
        const name = $el.find('h2, h3, .title, .tool-name').first().text().trim()
        const description = $el.find('.description, .excerpt, p').first().text().trim()
        const link = $el.find('a').first().attr('href') || ''
        const category = $el.find('.category, .tag').first().text().trim()
        
        if (name && name.length > 0) {
          entries.push({
            id: generateId(name, 'aitoptools', entries.length),
            name: name.substring(0, 100),
            category: mapCategory(category),
            description: cleanDescription(description || name, 300),
            platform: link.startsWith('http') ? link : `https://aitoptools.com${link}`,
            region: determineRegion(link),
            accessType: determineAccessType(),
            pricing: 'Unknown',
            tags: extractTags(description, category, name),
            popularity: normalizePopularity(55),
            lastUpdated: new Date().toISOString().split('T')[0],
            isTrending: false
          })
        }
      })
      
      // If no tools found on this page, stop
      if ($('.tool-item, .ai-tool, article').length === 0) break
      
      await rateLimiter.wait('aitoptools', 2000) // Delay between pages
    }
    
    console.log(`[Scrapers] Fetched ${entries.length} tools from AITopTools`)
  } catch (error: any) {
    console.error('[Scrapers] Error fetching from AITopTools:', error.message)
  }
  
  return entries
}

/**
 * Fetch from AIxploria
 */
async function fetchFromAIxploria(): Promise<AIEntry[]> {
  const entries: AIEntry[] = []
  
  try {
    await rateLimiter.wait('aixploria', 3000)
    
    const url = 'https://aixploria.com/'
    const response = await safeFetch(url)
    
    if (!response) {
      console.warn('[Scrapers] Could not fetch from AIxploria')
      return []
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    $('.tool, .ai-tool, [data-tool]').each((index, element) => {
      const $el = $(element)
      const name = $el.find('h2, h3, .name, .tool-title').first().text().trim()
      const description = $el.find('.description, .desc, p').first().text().trim()
      const link = $el.find('a').first().attr('href') || ''
      const category = $el.find('.category, .tag').first().text().trim()
      const pricing = $el.find('.price, .pricing').first().text().trim()
      
      if (name && name.length > 0) {
        entries.push({
          id: generateId(name, 'aixploria', index),
          name: name.substring(0, 100),
          category: mapCategory(category),
          description: cleanDescription(description || name, 300),
          platform: link.startsWith('http') ? link : `https://aixploria.com${link}`,
          region: determineRegion(link),
          accessType: determineAccessType(pricing),
          pricing: pricing || 'Free',
          tags: extractTags(description, category, name),
          popularity: normalizePopularity(50),
          lastUpdated: new Date().toISOString().split('T')[0],
          isTrending: false
        })
      }
    })
    
    console.log(`[Scrapers] Fetched ${entries.length} tools from AIxploria`)
  } catch (error: any) {
    console.error('[Scrapers] Error fetching from AIxploria:', error.message)
  }
  
  return entries
}

/**
 * Fetch from AI Tools Directory
 */
async function fetchFromAIToolsDirectory(): Promise<AIEntry[]> {
  const entries: AIEntry[] = []
  
  try {
    await rateLimiter.wait('aitoolsdirectory', 3000)
    
    // Try different category pages
    const categories = ['marketing', 'design', 'coding', 'writing', 'video']
    
    for (const category of categories) {
      const url = `https://aitoolsdirectory.com/category/${category}`
      const response = await safeFetch(url)
      
      if (!response) continue
      
      const html = await response.text()
      const $ = cheerio.load(html)
      
      $('.tool-card, .tool-item, article').each((index, element) => {
        const $el = $(element)
        const name = $el.find('h2, h3, .title').first().text().trim()
        const description = $el.find('.description, .excerpt, p').first().text().trim()
        const link = $el.find('a').first().attr('href') || ''
        
        if (name && name.length > 0) {
          entries.push({
            id: generateId(name, 'aitoolsdirectory', entries.length),
            name: name.substring(0, 100),
            category: mapCategory(category),
            description: cleanDescription(description || name, 300),
            platform: link.startsWith('http') ? link : `https://aitoolsdirectory.com${link}`,
            region: determineRegion(link),
            accessType: determineAccessType(),
            pricing: 'Unknown',
            tags: extractTags(description, category, name),
            popularity: normalizePopularity(52),
            lastUpdated: new Date().toISOString().split('T')[0],
            isTrending: false
          })
        }
      })
      
      await rateLimiter.wait('aitoolsdirectory', 2000) // Delay between categories
    }
    
    console.log(`[Scrapers] Fetched ${entries.length} tools from AI Tools Directory`)
  } catch (error: any) {
    console.error('[Scrapers] Error fetching from AI Tools Directory:', error.message)
  }
  
  return entries
}

/**
 * Fetch from all scrapers
 */
export async function fetchFromScrapers(): Promise<AIEntry[]> {
  console.log('\n🕷️  Phase 3: Scraping from tool directories...\n')
  
  const allEntries: AIEntry[] = []
  
  // Fetch from scrapers sequentially to avoid overwhelming servers
  const results = await Promise.allSettled([
    fetchFromAITopTools(),
    fetchFromAIxploria(),
    fetchFromAIToolsDirectory(),
  ])
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEntries.push(...result.value)
    } else {
      console.error('[Scrapers] Error:', result.reason)
    }
  }
  
  console.log(`\n✅ Phase 3 complete: Found ${allEntries.length} tools from scrapers\n`)
  return allEntries
}

