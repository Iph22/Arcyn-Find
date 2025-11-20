/**
 * News Sources Fetcher
 * Fetches new and trending AI tools from news websites, blogs, and newsletters
 */

import Parser from 'rss-parser'
import * as cheerio from 'cheerio'
import type { AIEntry } from '../../lib/ai-data'
import { mapCategory, determineAccessType, determineRegion, generateId, extractTags, cleanDescription, normalizePopularity } from '../utils/transformer'
import { rateLimiter } from '../utils/rate-limiter'

const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: ['description', 'content', 'content:encoded', 'media:content']
  }
})

interface NewsSource {
  name: string
  url: string
  type: 'rss' | 'scrape'
  selector?: string
}

const NEWS_SOURCES: NewsSource[] = [
  // Tech News Sites
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/tag/artificial-intelligence/feed/',
    type: 'rss'
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
    type: 'rss'
  },
  {
    name: 'Wired AI',
    url: 'https://www.wired.com/feed/tag/artificial-intelligence/latest',
    type: 'rss'
  },
  {
    name: 'Ars Technica AI',
    url: 'https://arstechnica.com/tag/artificial-intelligence/feed/',
    type: 'rss'
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/ai/feed/',
    type: 'rss'
  },
  {
    name: 'AI News',
    url: 'https://www.artificialintelligence-news.com/feed/',
    type: 'rss'
  },
  {
    name: 'Synced Review',
    url: 'https://syncedreview.com/feed/',
    type: 'rss'
  },
  {
    name: 'Towards Data Science',
    url: 'https://towardsdatascience.com/feed',
    type: 'rss'
  },
  {
    name: 'Analytics Vidhya',
    url: 'https://www.analyticsvidhya.com/blog/feed/',
    type: 'rss'
  },
  {
    name: 'AI Business',
    url: 'https://aibusiness.com/feed',
    type: 'rss'
  },
  // AI Company Blogs
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    type: 'rss'
  },
  {
    name: 'Anthropic Blog',
    url: 'https://www.anthropic.com/news',
    type: 'scrape',
    selector: 'article'
  },
  {
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog',
    type: 'scrape',
    selector: 'article'
  },
  // Newsletters and Aggregators
  {
    name: 'The Batch (DeepLearning.AI)',
    url: 'https://www.deeplearning.ai/the-batch/feed/',
    type: 'rss'
  },
  {
    name: 'AI Tool Report',
    url: 'https://aitoolreport.com/feed/',
    type: 'rss'
  }
]

/**
 * Extract AI tool names and information from article content
 */
function extractToolsFromContent(content: string, title: string, url?: string): { name?: string; description?: string; url?: string; category?: string }[] {
  const tools: { name?: string; description?: string; url?: string; category?: string }[] = []
  const text = `${title} ${content}`.toLowerCase()
  
  // Known new models to look for
  const knownModels = [
    { name: 'Gemini 3', keywords: ['gemini 3', 'gemini-3', 'google gemini 3'], category: 'Generative AI' },
    { name: 'GPT-5', keywords: ['gpt-5', 'gpt 5', 'gpt5', 'openai gpt-5'], category: 'Generative AI' },
    { name: 'GPT-4.5', keywords: ['gpt-4.5', 'gpt 4.5', 'gpt4.5'], category: 'Generative AI' },
    { name: 'Claude 4', keywords: ['claude 4', 'claude-4', 'claude4', 'anthropic claude 4'], category: 'Generative AI' },
    { name: 'Claude 3.7 Sonnet', keywords: ['claude 3.7', 'claude-3.7', 'claude 3.7 sonnet'], category: 'Generative AI' },
    { name: 'Claude Sonnet 4.5', keywords: ['claude sonnet 4.5', 'sonnet 4.5'], category: 'Generative AI' },
    { name: 'Gemini 2.5', keywords: ['gemini 2.5', 'gemini-2.5'], category: 'Generative AI' },
    { name: 'Gemini 2.0', keywords: ['gemini 2.0', 'gemini-2.0'], category: 'Generative AI' },
    { name: 'Antigravity', keywords: ['antigravity', 'google antigravity'], category: 'ML Infrastructure' },
    { name: 'Gemini Agent', keywords: ['gemini agent', 'google gemini agent'], category: 'Autonomous AI' },
  ]
  
  // Check for known models
  for (const model of knownModels) {
    const found = model.keywords.some(keyword => text.includes(keyword))
    if (found) {
      tools.push({
        name: model.name,
        description: `Latest AI model mentioned in: ${title.substring(0, 150)}`,
        url: url || '',
        category: model.category
      })
    }
  }
  
  // Extract URLs that might be tools
  const urlPattern = /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+)\.(?:com|io|ai|dev|app|co|org|net|tech|tools|site|xyz)/gi
  const urlMatches = [...text.matchAll(urlPattern)]
  const seenDomains = new Set<string>()
  
  // Skip common non-tool domains
  const skipDomains = [
    'google', 'github', 'youtube', 'twitter', 'x', 'facebook', 'linkedin',
    'reddit', 'medium', 'wikipedia', 'arxiv', 'ieee', 'acm', 'nature',
    'science', 'techcrunch', 'theverge', 'wired', 'zdnet', 'mit',
    'deepmind', 'openai', 'anthropic', 'huggingface', 'paperswithcode',
    'reuters', 'apnews', 'bloomberg', 'cnn', 'bbc', 'nytimes', 'wsj',
    'techcrunch', 'venturebeat', 'ars-technica', 'analyticsvidhya'
  ]
  
  for (const urlMatch of urlMatches.slice(0, 10)) {
    const domain = urlMatch[1]?.toLowerCase()
    const fullUrl = urlMatch[0]
    
    if (domain && domain.length > 3 && !skipDomains.includes(domain) && !seenDomains.has(domain)) {
      seenDomains.add(domain)
      
      // Check if it's mentioned as an AI tool
      const contextBefore = text.substring(Math.max(0, text.indexOf(domain) - 100), text.indexOf(domain))
      const contextAfter = text.substring(text.indexOf(domain), Math.min(text.length, text.indexOf(domain) + 100))
      const context = `${contextBefore} ${contextAfter}`
      
      const aiKeywords = ['ai tool', 'ai platform', 'ai service', 'ai app', 'artificial intelligence', 'machine learning', 'llm', 'model']
      const isAITool = aiKeywords.some(keyword => context.includes(keyword))
      
      if (isAITool) {
        const toolName = domain
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        
        tools.push({
          name: toolName,
          description: `AI tool mentioned in: ${title.substring(0, 150)}`,
          url: fullUrl
        })
      }
    }
  }
  
  // Extract tool names from text patterns
  const toolPatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:AI|tool|platform|service|app|model|agent)\b/g,
    /\b(?:new|latest|trending)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:AI|tool)\b/g,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+launches?\s+(?:new|AI|tool)\b/g,
  ]
  
  for (const pattern of toolPatterns) {
    const matches = [...text.matchAll(pattern)]
    for (const match of matches.slice(0, 5)) {
      const toolName = match[1]?.trim()
      if (toolName && toolName.length > 2 && toolName.length < 50 && !seenDomains.has(toolName.toLowerCase())) {
        seenDomains.add(toolName.toLowerCase())
        tools.push({
          name: toolName,
          description: `AI tool mentioned in: ${title.substring(0, 150)}`,
          url: url || ''
        })
      }
    }
  }
  
  return tools
}

/**
 * Fetch tools from RSS feed
 */
async function fetchFromRSSFeed(source: NewsSource): Promise<AIEntry[]> {
  try {
    await rateLimiter.wait(source.name, 2000)
    
    const feed = await parser.parseURL(source.url)
    const entries: AIEntry[] = []
    
    if (!feed.items || feed.items.length === 0) {
      console.warn(`[News] No items found in ${source.name}`)
      return []
    }
    
    // Process recent items (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    const recentItems = feed.items.filter(item => {
      if (!item.pubDate) return true
      const pubDate = new Date(item.pubDate).getTime()
      return pubDate >= thirtyDaysAgo
    }).slice(0, 30) // Limit to 30 most recent
    
    for (const item of recentItems) {
      const content = item.contentSnippet || item.content || item.description || ''
      const title = item.title || 'Untitled'
      const link = item.link || ''
      
      // Extract tools from content
      const extractedTools = extractToolsFromContent(content, title, link)
      
      for (const tool of extractedTools) {
        entries.push({
          id: generateId(tool.name || title, source.name.toLowerCase().replace(/\s+/g, '-')),
          name: tool.name || title.substring(0, 100),
          category: tool.category || mapCategory('news'),
          description: cleanDescription(tool.description || content.substring(0, 200) || title, 300),
          platform: tool.url || link || '',
          region: determineRegion(link),
          accessType: determineAccessType(),
          pricing: 'Unknown',
          tags: extractTags(content, tool.category || 'news', tool.name),
          popularity: normalizePopularity(60), // Higher default for news-sourced tools
          lastUpdated: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          isTrending: true // Mark as trending since it's from news
        })
      }
    }
    
    console.log(`[News] Fetched ${entries.length} tools from ${source.name}`)
    return entries
  } catch (error: any) {
    console.error(`[News] Error fetching from ${source.name}:`, error.message)
    return []
  }
}

/**
 * Scrape tools from a website
 */
async function scrapeWebsite(source: NewsSource): Promise<AIEntry[]> {
  try {
    await rateLimiter.wait(source.name, 3000)
    
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      console.warn(`[News] Failed to fetch ${source.name}: ${response.status}`)
      return []
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    const entries: AIEntry[] = []
    
    // Try to find articles
    const articles = $(source.selector || 'article, .post, .entry, .article').slice(0, 20)
    
    articles.each((_, element) => {
      const $el = $(element)
      const title = $el.find('h1, h2, h3, .title, a').first().text().trim()
      const link = $el.find('a').first().attr('href') || source.url
      const content = $el.text()
      
      if (!title || title.length < 10) return
      
      const extractedTools = extractToolsFromContent(content, title, link)
      
      for (const tool of extractedTools) {
        entries.push({
          id: generateId(tool.name || title, source.name.toLowerCase().replace(/\s+/g, '-')),
          name: tool.name || title.substring(0, 100),
          category: tool.category || mapCategory('news'),
          description: cleanDescription(tool.description || content.substring(0, 200) || title, 300),
          platform: tool.url || link || '',
          region: determineRegion(link),
          accessType: determineAccessType(),
          pricing: 'Unknown',
          tags: extractTags(content, tool.category || 'news', tool.name),
          popularity: normalizePopularity(60),
          lastUpdated: new Date().toISOString().split('T')[0],
          isTrending: true
        })
      }
    })
    
    console.log(`[News] Scraped ${entries.length} tools from ${source.name}`)
    return entries
  } catch (error: any) {
    console.error(`[News] Error scraping ${source.name}:`, error.message)
    return []
  }
}

/**
 * Fetch tools from all news sources
 */
export async function fetchFromNewsSources(): Promise<AIEntry[]> {
  console.log('\n📰 Fetching from news sources, blogs, and newsletters...\n')
  
  const allEntries: AIEntry[] = []
  
  for (const source of NEWS_SOURCES) {
    try {
      let entries: AIEntry[] = []
      
      if (source.type === 'rss') {
        entries = await fetchFromRSSFeed(source)
      } else if (source.type === 'scrape') {
        entries = await scrapeWebsite(source)
      }
      
      allEntries.push(...entries)
    } catch (error: any) {
      console.error(`[News] Failed to fetch from ${source.name}:`, error.message)
    }
  }
  
  console.log(`\n✅ News sources complete: Found ${allEntries.length} tools\n`)
  return allEntries
}

