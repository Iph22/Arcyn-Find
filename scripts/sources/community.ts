/**
 * Phase 4: Community Sources
 * Fetches from Reddit, HackerNoon, and other community platforms
 */

import Parser from 'rss-parser'
import * as cheerio from 'cheerio'
import type { AIEntry } from '../../lib/ai-data'
import { mapCategory, determineAccessType, determineRegion, generateId, extractTags, cleanDescription, normalizePopularity } from '../utils/transformer'
import { rateLimiter } from '../utils/rate-limiter'

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: ['description', 'content', 'content:encoded']
  }
})

/**
 * Safe fetch with retry logic
 */
async function safeFetch(url: string, retries = 3): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/html, */*',
        },
        signal: AbortSignal.timeout(15000),
      })
      
      if (response.ok) {
        return response
      }
    } catch (error: any) {
      if (i === retries - 1) {
        console.error(`[Community] Failed to fetch ${url} after ${retries} attempts:`, error.message)
        return null
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  return null
}

/**
 * Extract tool mentions from Reddit post
 */
function extractToolsFromRedditPost(title: string, selftext: string): { name?: string; url?: string }[] {
  const tools: { name?: string; url?: string }[] = []
  const text = `${title} ${selftext}`.toLowerCase()
  
  // Look for URLs
  const urlPattern = /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+)\.(?:com|io|ai|dev|app|co)/g
  const urls = [...text.matchAll(urlPattern)]
  
  for (const urlMatch of urls.slice(0, 5)) {
    const domain = urlMatch[1]
    if (domain && domain.length > 3 && !['reddit', 'github', 'youtube', 'twitter', 'x'].includes(domain)) {
      tools.push({
        name: domain.charAt(0).toUpperCase() + domain.slice(1),
        url: urlMatch[0]
      })
    }
  }
  
  // Look for tool names in title (common patterns)
  const toolPatterns = [
    /(?:check out|try|using|recommend)\s+([A-Z][a-zA-Z0-9\s-]+)/gi,
    /([A-Z][a-zA-Z0-9\s-]+)\s+(?:is|are|was|were)\s+(?:great|awesome|amazing|useful)/gi,
  ]
  
  for (const pattern of toolPatterns) {
    const matches = [...title.matchAll(pattern)]
    for (const match of matches.slice(0, 3)) {
      const name = match[1]?.trim()
      if (name && name.length > 2 && name.length < 50) {
        tools.push({ name })
      }
    }
  }
  
  return tools
}

/**
 * Fetch from Reddit API
 * Note: Reddit API requires authentication for some endpoints, but we can use JSON endpoints
 */
async function fetchFromReddit(): Promise<AIEntry[]> {
  const entries: AIEntry[] = []
  
  try {
    await rateLimiter.wait('reddit', 2000)
    
    // Reddit JSON endpoints (no auth required for public data)
    const subreddits = ['MachineLearning', 'LocalLLaMA', 'artificial', 'ChatGPT', 'OpenAI']
    
    for (const subreddit of subreddits) {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`
      const response = await safeFetch(url)
      
      if (!response) continue
      
      const data = await response.json()
      
      if (data.data && data.data.children) {
        for (const post of data.data.children) {
          const postData = post.data
          const title = postData.title || ''
          const selftext = postData.selftext || ''
          const url = postData.url || ''
          const score = postData.score || 0
          
          // Extract tools from post
          const tools = extractToolsFromRedditPost(title, selftext)
          
          for (const tool of tools) {
            if (tool.name) {
              entries.push({
                id: generateId(tool.name, `reddit-${subreddit}`, entries.length),
                name: tool.name.substring(0, 100),
                category: mapCategory(subreddit.toLowerCase()),
                description: cleanDescription(selftext.substring(0, 200) || title, 300),
                platform: tool.url || url || '',
                region: determineRegion(url),
                accessType: determineAccessType(),
                pricing: 'Unknown',
                tags: extractTags(selftext, subreddit, tool.name),
                popularity: normalizePopularity(50 + Math.log10(score + 1) * 5),
                lastUpdated: new Date(postData.created_utc * 1000).toISOString().split('T')[0],
                isTrending: score > 100
              })
            }
          }
        }
      }
      
      await rateLimiter.wait('reddit', 2000) // Delay between subreddits
    }
    
    console.log(`[Community] Fetched ${entries.length} tools from Reddit`)
  } catch (error: any) {
    console.error('[Community] Error fetching from Reddit:', error.message)
  }
  
  return entries
}

/**
 * Fetch from HackerNoon RSS
 */
async function fetchFromHackerNoon(): Promise<AIEntry[]> {
  const entries: AIEntry[] = []
  
  try {
    await rateLimiter.wait('hackernoon', 2000)
    
    // HackerNoon RSS feed for AI/ML topics
    const feedUrl = 'https://hackernoon.com/tagged/artificial-intelligence/feed'
    const feed = await parser.parseURL(feedUrl)
    
    if (!feed.items || feed.items.length === 0) {
      console.warn('[Community] No items found in HackerNoon feed')
      return []
    }
    
    for (const item of feed.items.slice(0, 30)) {
      const title = item.title || ''
      const content = item.contentSnippet || item.content || item.description || ''
      const link = item.link || ''
      
      // Extract tool mentions from content
      const urlPattern = /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+)\.(?:com|io|ai|dev|app)/g
      const urls = [...content.matchAll(urlPattern)]
      
      for (const urlMatch of urls.slice(0, 3)) {
        const domain = urlMatch[1]
        if (domain && domain.length > 3) {
          entries.push({
            id: generateId(domain, 'hackernoon', entries.length),
            name: domain.charAt(0).toUpperCase() + domain.slice(1),
            category: mapCategory('news'),
            description: cleanDescription(content.substring(0, 200) || title, 300),
            platform: urlMatch[0],
            region: determineRegion(urlMatch[0]),
            accessType: determineAccessType(),
            pricing: 'Unknown',
            tags: extractTags(content, 'artificial-intelligence', domain),
            popularity: normalizePopularity(45),
            lastUpdated: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            isTrending: false
          })
        }
      }
    }
    
    console.log(`[Community] Fetched ${entries.length} tools from HackerNoon`)
  } catch (error: any) {
    console.error('[Community] Error fetching from HackerNoon:', error.message)
  }
  
  return entries
}

/**
 * Fetch from all community sources
 */
export async function fetchFromCommunity(): Promise<AIEntry[]> {
  console.log('\n👥 Phase 4: Fetching from community sources...\n')
  
  const allEntries: AIEntry[] = []
  
  // Fetch from community sources
  const results = await Promise.allSettled([
    fetchFromReddit(),
    fetchFromHackerNoon(),
  ])
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEntries.push(...result.value)
    } else {
      console.error('[Community] Error:', result.reason)
    }
  }
  
  console.log(`\n✅ Phase 4 complete: Found ${allEntries.length} tools from community sources\n`)
  return allEntries
}

