/**
 * Phase 1: RSS Feed Fetchers
 * Fetches AI tools and news from RSS feeds
 */

import Parser from 'rss-parser'
import type { AIEntry } from '../../lib/ai-data'
import { mapCategory, determineAccessType, determineRegion, generateId, extractTags, cleanDescription, normalizePopularity } from '../utils/transformer'
import { rateLimiter } from '../utils/rate-limiter'

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: ['description', 'content', 'content:encoded']
  }
})

interface RSSSource {
  name: string
  url: string
  type: 'news' | 'tools'
  category?: string
}

const RSS_SOURCES: RSSSource[] = [
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    type: 'news',
    category: 'Research Paper'
  },
  {
    name: 'ZDNet AI',
    url: 'https://www.zdnet.com/topic/artificial-intelligence/rss.xml',
    type: 'news',
    category: 'Generative AI'
  },
  {
    name: 'Google AI Blog',
    url: 'https://ai.googleblog.com/feeds/posts/default?alt=rss',
    type: 'news',
    category: 'Generative AI'
  },
  {
    name: 'DeepMind Blog',
    url: 'https://deepmind.google/discover/blog/feed/',
    type: 'news',
    category: 'Generative AI'
  },
  {
    name: 'KDnuggets',
    url: 'https://www.kdnuggets.com/feed',
    type: 'news',
    category: 'ML Infrastructure'
  },
  {
    name: 'MarkTechPost',
    url: 'https://www.marktechpost.com/feed/',
    type: 'news',
    category: 'Research Paper'
  }
]

/**
 * Extract tool names and information from RSS feed content
 */
function extractToolsFromContent(content: string, title: string): { name?: string; description?: string; url?: string }[] {
  const tools: { name?: string; description?: string; url?: string }[] = []
  const text = `${title} ${content}`
  
  // Look for URLs that might be tools (more comprehensive pattern)
  const urlPattern = /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+)\.(?:com|io|ai|dev|app|co|org|net|tech|tools|site)/gi
  const urlMatches = [...text.matchAll(urlPattern)]
  
  // Track seen domains to avoid duplicates
  const seenDomains = new Set<string>()
  
  for (const urlMatch of urlMatches.slice(0, 5)) {
    const domain = urlMatch[1]?.toLowerCase()
    const fullUrl = urlMatch[0]
    
    // Skip common non-tool domains
    const skipDomains = [
      'google', 'github', 'youtube', 'twitter', 'x', 'facebook', 'linkedin',
      'reddit', 'medium', 'wikipedia', 'arxiv', 'ieee', 'acm', 'nature',
      'science', 'techcrunch', 'theverge', 'wired', 'zdnet', 'mit',
      'deepmind', 'openai', 'anthropic', 'huggingface', 'paperswithcode'
    ]
    
    if (domain && domain.length > 3 && !skipDomains.includes(domain) && !seenDomains.has(domain)) {
      seenDomains.add(domain)
      const toolName = domain
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      
      tools.push({
        name: toolName,
        description: `AI tool mentioned in: ${title.substring(0, 100)}`,
        url: fullUrl
      })
    }
  }
  
  // Also look for tool names in text (capitalized words that might be tool names)
  const toolNamePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:AI|tool|platform|service|app)/g
  const nameMatches = [...text.matchAll(toolNamePattern)]
  
  for (const match of nameMatches.slice(0, 3)) {
    const toolName = match[1]?.trim()
    if (toolName && toolName.length > 2 && toolName.length < 50 && !seenDomains.has(toolName.toLowerCase())) {
      seenDomains.add(toolName.toLowerCase())
      tools.push({
        name: toolName,
        description: `AI tool mentioned in: ${title.substring(0, 100)}`,
        url: ''
      })
    }
  }
  
  return tools
}

/**
 * Fetch tools from a single RSS feed
 */
async function fetchFromRSSFeed(source: RSSSource): Promise<AIEntry[]> {
  try {
    await rateLimiter.wait(source.name, 2000) // 2 second delay between RSS feeds
    
    const feed = await parser.parseURL(source.url)
    const entries: AIEntry[] = []
    
    if (!feed.items || feed.items.length === 0) {
      console.warn(`[RSS] No items found in ${source.name}`)
      return []
    }
    
    for (const item of feed.items.slice(0, 20)) { // Limit to 20 items per feed
      const content = item.contentSnippet || item.content || item.description || ''
      const title = item.title || 'Untitled'
      const link = item.link || ''
      
      // Extract tools from content
      const extractedTools = extractToolsFromContent(content, title)
      
      if (extractedTools.length > 0) {
        for (const tool of extractedTools) {
          entries.push({
            id: generateId(tool.name || title, source.name.toLowerCase().replace(/\s+/g, '-')),
            name: tool.name || title.substring(0, 100),
            category: source.category || mapCategory('news'),
            description: cleanDescription(tool.description || content.substring(0, 200) || title, 300),
            platform: tool.url || link || '',
            region: determineRegion(link),
            accessType: determineAccessType(),
            pricing: 'Unknown',
            tags: extractTags(content, source.category, tool.name),
            popularity: normalizePopularity(50), // Default popularity for RSS-sourced tools
            lastUpdated: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            isTrending: false
          })
        }
      } else if (source.type === 'tools') {
        // If it's a tools feed, treat each item as a potential tool
        entries.push({
          id: generateId(title, source.name.toLowerCase().replace(/\s+/g, '-')),
          name: title.substring(0, 100),
          category: source.category || mapCategory('news'),
          description: cleanDescription(content.substring(0, 200) || title, 300),
          platform: link || '',
          region: determineRegion(link),
          accessType: determineAccessType(),
          pricing: 'Unknown',
          tags: extractTags(content, source.category, title),
          popularity: normalizePopularity(50),
          lastUpdated: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          isTrending: false
        })
      }
    }
    
    console.log(`[RSS] Fetched ${entries.length} tools from ${source.name}`)
    return entries
  } catch (error: any) {
    console.error(`[RSS] Error fetching from ${source.name}:`, error.message)
    return []
  }
}

/**
 * Fetch tools from all RSS feeds
 */
export async function fetchFromRSSFeeds(): Promise<AIEntry[]> {
  console.log('\n📰 Phase 1: Fetching from RSS feeds...\n')
  
  const allEntries: AIEntry[] = []
  
  for (const source of RSS_SOURCES) {
    try {
      const entries = await fetchFromRSSFeed(source)
      allEntries.push(...entries)
    } catch (error: any) {
      console.error(`[RSS] Failed to fetch from ${source.name}:`, error.message)
    }
  }
  
  console.log(`\n✅ Phase 1 complete: Found ${allEntries.length} tools from RSS feeds\n`)
  return allEntries
}

