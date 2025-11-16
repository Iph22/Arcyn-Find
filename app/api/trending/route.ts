import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'

interface TrendingSource {
  name: string
  score: number
  source: string
  timestamp: number
}

// Rate limiting: delay between requests (ms)
const REQUEST_DELAY = 1000 // 1 second between requests
const MAX_RETRIES = 2

/**
 * Delay function to respect rate limits
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Safe fetch with retries, exponential backoff, and error handling
 */
async function safeFetch(
  url: string, 
  options: RequestInit = {}, 
  retries = MAX_RETRIES,
  attempt = 1
): Promise<Response | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...options.headers,
      },
      next: { revalidate: 300 }, // 5 minute cache
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok && retries > 0) {
      // Exponential backoff: delay increases with each retry
      const backoffDelay = REQUEST_DELAY * Math.pow(2, attempt - 1)
      await delay(backoffDelay)
      return safeFetch(url, options, retries - 1, attempt + 1)
    }
    
    return response.ok ? response : null
  } catch (error) {
    // Handle timeout and network errors
    if (retries > 0 && (error instanceof Error && error.name !== 'AbortError')) {
      // Exponential backoff for network errors
      const backoffDelay = REQUEST_DELAY * Math.pow(2, attempt - 1)
      await delay(backoffDelay)
      return safeFetch(url, options, retries - 1, attempt + 1)
    }
    return null
  }
}

/**
 * Extract AI tool name from text using multiple patterns
 */
function extractToolName(text: string): string | null {
  if (!text || text.length < 3) return null
  
  // Common patterns for AI tool names
  const patterns = [
    /(?:using|try|check out|introducing|announcing|new|latest)\s+([A-Z][a-zA-Z0-9\s-]{2,30}?)(?:\s+(?:AI|GPT|LLM|model|tool|assistant|platform)|[:.,!?]|$)/i,
    /([A-Z][a-zA-Z0-9\s-]{2,30}?)\s+(?:AI|GPT|LLM|model|tool|assistant|platform|by)/i,
    /(?:^|\s)([A-Z][a-zA-Z0-9\s-]{2,30}?)\s+(?:is|was|are|were)\s+(?:a|an|the)\s+(?:AI|GPT|LLM)/i,
    /(?:^|\s)([A-Z][a-zA-Z0-9\s-]{2,30}?)(?:\s|$)/,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      let name = match[1].trim()
      
      // Clean up the name
      name = name.replace(/^(the|a|an|new|latest|introducing|announcing)\s+/i, '')
      name = name.replace(/\s+(AI|GPT|LLM|model|tool|assistant|platform)$/i, '')
      
      // Filter out invalid names
      if (name.length >= 2 && name.length <= 50 && 
          !/^(is|are|was|were|the|a|an|this|that|it)$/i.test(name) &&
          !/^[0-9]+$/.test(name)) {
        return name
      }
    }
  }
  
  return null
}

/**
 * Scrape Product Hunt for trending AI tools
 */
async function scrapeProductHunt(): Promise<TrendingSource[]> {
  try {
    await delay(REQUEST_DELAY)
    
    // Product Hunt has an API, but we'll scrape their trending page
    const response = await safeFetch('https://www.producthunt.com/topics/artificial-intelligence', {
      method: 'GET',
    })
    
    if (!response) return []
    
    const html = await response.text()
    const $ = cheerio.load(html)
    const trending: TrendingSource[] = []
    
    // Product Hunt structure: look for product cards
    $('[data-test="post-item"], .styles_item, .postItem').each((index, element) => {
      if (index >= 15) return false // Limit to top 15
      
      const title = $(element).find('h3, [data-test="post-name"], .styles_title').first().text().trim()
      const votes = parseInt($(element).find('[data-test="vote-button"], .styles_voteCount').first().text().trim()) || 0
      
      if (title) {
        const toolName = extractToolName(title) || title.toLowerCase().trim()
        trending.push({
          name: toolName,
          score: (15 - index) * 3 + votes * 0.1,
          source: 'producthunt',
          timestamp: Date.now(),
        })
      }
    })
    
    return trending
  } catch (error) {
    console.error('Failed to scrape Product Hunt:', error)
    return []
  }
}

/**
 * Scrape Hacker News for AI-related trending posts
 */
async function scrapeHackerNews(): Promise<TrendingSource[]> {
  try {
    await delay(REQUEST_DELAY)
    
    // Use Hacker News API (more reliable than scraping)
    const response = await safeFetch('https://hacker-news.firebaseio.com/v0/topstories.json')
    
    if (!response) return []
    
    const storyIds: number[] = await response.json()
    const trending: TrendingSource[] = []
    
    // Get top 50 stories
    const topStoryIds = storyIds.slice(0, 50)
    const aiKeywords = [
      'ai', 'artificial intelligence', 'machine learning', 'deep learning',
      'llm', 'gpt', 'claude', 'copilot', 'openai', 'anthropic', 'gemini',
      'neural network', 'transformer', 'language model', 'chatbot', 'assistant'
    ]
    
    // Process stories in batches to avoid overwhelming the API
    for (let i = 0; i < topStoryIds.length; i += 10) {
      const batch = topStoryIds.slice(i, i + 10)
      const stories = await Promise.all(
        batch.map(async (id) => {
          await delay(100) // Small delay between API calls
          const storyRes = await safeFetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          if (!storyRes) return null
          return storyRes.json()
        })
      )
      
      stories.forEach((story: any, batchIndex: number) => {
        if (!story || !story.title) return
        
        const titleLower = story.title.toLowerCase()
        const isAI = aiKeywords.some(keyword => titleLower.includes(keyword))
        
        if (isAI) {
          const toolName = extractToolName(story.title) || story.title.toLowerCase().substring(0, 50)
          const globalIndex = i + batchIndex
          trending.push({
            name: toolName,
            score: (50 - globalIndex) * 2 + (story.score || 0) * 0.2,
            source: 'hackernews',
            timestamp: Date.now(),
          })
        }
      })
      
      if (i + 10 < topStoryIds.length) {
        await delay(REQUEST_DELAY)
      }
    }
    
    return trending
  } catch (error) {
    console.error('Failed to scrape Hacker News:', error)
    return []
  }
}

/**
 * Scrape Reddit for trending AI tools
 */
async function scrapeReddit(): Promise<TrendingSource[]> {
  try {
    const subreddits = [
      'MachineLearning',
      'artificial',
      'ChatGPT',
      'OpenAI',
      'LocalLLaMA',
      'singularity',
      'agi',
      'artificial',
    ]
    
    const trending: TrendingSource[] = []
    
    for (const subreddit of subreddits) {
      await delay(REQUEST_DELAY)
      
      try {
        const response = await safeFetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=15`, {
          headers: {
            'User-Agent': 'ArcynFind/1.0 (Educational Research)',
          },
        })
        
        if (!response) continue
        
        const data = await response.json()
        const posts = data.data?.children || []
        
        posts.forEach((post: any, index: number) => {
          if (!post.data?.title) return
          
          const toolName = extractToolName(post.data.title) || post.data.title.toLowerCase().substring(0, 50)
          const score = post.data.score || 0
          const comments = post.data.num_comments || 0
          
          trending.push({
            name: toolName,
            score: (15 - index) * 1.5 + score * 0.1 + comments * 0.05,
            source: `reddit-${subreddit}`,
            timestamp: Date.now(),
          })
        })
      } catch (error) {
        console.error(`Failed to scrape r/${subreddit}:`, error)
        // Continue with next subreddit
      }
    }
    
    return trending
  } catch (error) {
    console.error('Failed to scrape Reddit:', error)
    return []
  }
}

/**
 * Scrape GitHub Trending for AI repositories
 */
async function scrapeGitHubTrending(): Promise<TrendingSource[]> {
  try {
    await delay(REQUEST_DELAY)
    
    // Use GitHub API for trending (more reliable)
    const languages = ['python', 'javascript', 'typescript']
    const keywords = ['ai', 'machine-learning', 'deep-learning', 'llm', 'gpt', 'neural-network']
    const trending: TrendingSource[] = []
    
    for (const keyword of keywords.slice(0, 3)) { // Limit to avoid rate limits
      await delay(REQUEST_DELAY)
      
      try {
        const response = await safeFetch(
          `https://api.github.com/search/repositories?q=${keyword}+stars:>100+language:python&sort=stars&order=desc&per_page=10`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        )
        
        if (!response) continue
        
        const data = await response.json()
        const repos = data.items || []
        
        repos.forEach((repo: any, index: number) => {
          const name = repo.name.toLowerCase()
          trending.push({
            name: name,
            score: (10 - index) * 2 + Math.min(repo.stargazers_count / 1000, 20),
            source: 'github',
            timestamp: Date.now(),
          })
        })
      } catch (error) {
        console.error(`Failed to fetch GitHub trending for ${keyword}:`, error)
      }
    }
    
    return trending
  } catch (error) {
    console.error('Failed to scrape GitHub Trending:', error)
    return []
  }
}

/**
 * Scrape "There's An AI For That" directory
 */
async function scrapeTheresAnAIForThat(): Promise<TrendingSource[]> {
  try {
    await delay(REQUEST_DELAY)
    
    // Try their API first
    const response = await safeFetch('https://theresanaiforthat.com/api/ai_tools/?limit=30', {
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response) return []
    
    const data = await response.json()
    const trending: TrendingSource[] = []
    
    if (Array.isArray(data)) {
      data.slice(0, 30).forEach((tool: any, index: number) => {
        if (tool.name) {
          trending.push({
            name: tool.name.toLowerCase().trim(),
            score: (30 - index) * 1.5 + (tool.rating || 0) * 2,
            source: 'theresanaiforthat',
            timestamp: Date.now(),
          })
        }
      })
    }
    
    return trending
  } catch (error) {
    console.error('Failed to scrape There\'s An AI For That:', error)
    return []
  }
}

/**
 * Scrape Futurepedia (AI tools directory)
 */
async function scrapeFuturepedia(): Promise<TrendingSource[]> {
  try {
    await delay(REQUEST_DELAY)
    
    const response = await safeFetch('https://www.futurepedia.io/api/tools?limit=30&sort=trending', {
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response) return []
    
    const data = await response.json()
    const trending: TrendingSource[] = []
    
    if (data.tools && Array.isArray(data.tools)) {
      data.tools.slice(0, 30).forEach((tool: any, index: number) => {
        if (tool.name) {
          trending.push({
            name: tool.name.toLowerCase().trim(),
            score: (30 - index) * 1.5 + (tool.views || 0) * 0.01,
            source: 'futurepedia',
            timestamp: Date.now(),
          })
        }
      })
    }
    
    return trending
  } catch (error) {
    console.error('Failed to scrape Futurepedia:', error)
    return []
  }
}

/**
 * Scrape AI Tools Directory (aitoolsdirectory.com)
 */
async function scrapeAIToolsDirectory(): Promise<TrendingSource[]> {
  try {
    await delay(REQUEST_DELAY)
    
    const response = await safeFetch('https://aitoolsdirectory.com/api/tools?limit=30', {
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response) {
      // Fallback: try scraping the HTML
      const htmlResponse = await safeFetch('https://aitoolsdirectory.com/trending')
      if (!htmlResponse) return []
      
      const html = await htmlResponse.text()
      const $ = cheerio.load(html)
      const trending: TrendingSource[] = []
      
      $('.tool-item, .tool-card, [data-tool]').each((index, element) => {
        if (index >= 20) return false
        
        const name = $(element).find('h3, .tool-name, [data-name]').first().text().trim()
        if (name) {
          trending.push({
            name: name.toLowerCase().trim(),
            score: (20 - index) * 2,
            source: 'aitoolsdirectory',
            timestamp: Date.now(),
          })
        }
      })
      
      return trending
    }
    
    const data = await response.json()
    const trending: TrendingSource[] = []
    
    if (data.tools && Array.isArray(data.tools)) {
      data.tools.slice(0, 30).forEach((tool: any, index: number) => {
        if (tool.name) {
          trending.push({
            name: tool.name.toLowerCase().trim(),
            score: (30 - index) * 1.5,
            source: 'aitoolsdirectory',
            timestamp: Date.now(),
          })
        }
      })
    }
    
    return trending
  } catch (error) {
    console.error('Failed to scrape AI Tools Directory:', error)
    return []
  }
}

/**
 * Scrape Twitter/X trends (using public RSS or API if available)
 */
async function scrapeTwitterTrends(): Promise<TrendingSource[]> {
  try {
    await delay(REQUEST_DELAY)
    
    // Note: Twitter API requires authentication
    // For now, we'll skip this or use a public RSS feed if available
    // You can integrate Twitter API v2 if you have credentials
    
    return []
  } catch (error) {
    console.error('Failed to scrape Twitter trends:', error)
    return []
  }
}

/**
 * GET /api/trending
 * Fetches real-time trending AI tools from multiple sources
 */
export async function GET(request: Request) {
  // Rate limiting - more lenient for trending (cached longer)
  const rateLimit = checkRateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute (trending is expensive)
  })
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        message: 'Rate limit exceeded. Maximum 30 requests per minute for trending data.',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      },
      { 
        status: 429,
        headers: {
          ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
          'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
        }
      }
    )
  }
  
  const startTime = Date.now()
  
  try {
    // Fetch from all sources in parallel (with delays built-in)
    const [
      productHunt,
      hackerNews,
      reddit,
      github,
      theresAnAI,
      futurepedia,
      aitoolsDirectory,
    ] = await Promise.allSettled([
      scrapeProductHunt(),
      scrapeHackerNews(),
      scrapeReddit(),
      scrapeGitHubTrending(),
      scrapeTheresAnAIForThat(),
      scrapeFuturepedia(),
      scrapeAIToolsDirectory(),
    ])
    
    // Combine all trending data
    const allTrending: TrendingSource[] = []
    
    if (productHunt.status === 'fulfilled') allTrending.push(...productHunt.value)
    if (hackerNews.status === 'fulfilled') allTrending.push(...hackerNews.value)
    if (reddit.status === 'fulfilled') allTrending.push(...reddit.value)
    if (github.status === 'fulfilled') allTrending.push(...github.value)
    if (theresAnAI.status === 'fulfilled') allTrending.push(...theresAnAI.value)
    if (futurepedia.status === 'fulfilled') allTrending.push(...futurepedia.value)
    if (aitoolsDirectory.status === 'fulfilled') allTrending.push(...aitoolsDirectory.value)
    
    // Aggregate scores by tool name (normalize names)
    const aggregated: Record<string, { score: number; sources: string[] }> = {}
    
    allTrending.forEach((item) => {
      // Normalize the name (remove common suffixes, lowercase, trim)
      const normalizedName = item.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s-]/g, '')
      
      if (normalizedName.length < 2) return
      
      if (!aggregated[normalizedName]) {
        aggregated[normalizedName] = { score: 0, sources: [] }
      }
      
      aggregated[normalizedName].score += item.score
      if (!aggregated[normalizedName].sources.includes(item.source)) {
        aggregated[normalizedName].sources.push(item.source)
      }
    })
    
    // Boost score for tools mentioned in multiple sources
    Object.keys(aggregated).forEach(name => {
      const sourceCount = aggregated[name].sources.length
      if (sourceCount > 1) {
        aggregated[name].score *= (1 + sourceCount * 0.2) // 20% boost per additional source
      }
    })
    
    // Sort by score and get top 100
    const sorted = Object.entries(aggregated)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 100)
      .reduce((acc, [name, data]) => {
        acc[name] = data.score
        return acc
      }, {} as Record<string, number>)
    
    const processingTime = Date.now() - startTime
    
    return NextResponse.json(
      {
        trending: sorted,
        sources: {
          productHunt: productHunt.status === 'fulfilled' ? productHunt.value.length : 0,
          hackerNews: hackerNews.status === 'fulfilled' ? hackerNews.value.length : 0,
          reddit: reddit.status === 'fulfilled' ? reddit.value.length : 0,
          github: github.status === 'fulfilled' ? github.value.length : 0,
          theresAnAI: theresAnAI.status === 'fulfilled' ? theresAnAI.value.length : 0,
          futurepedia: futurepedia.status === 'fulfilled' ? futurepedia.value.length : 0,
          aitoolsDirectory: aitoolsDirectory.status === 'fulfilled' ? aitoolsDirectory.value.length : 0,
        },
        totalItems: allTrending.length,
        uniqueTools: Object.keys(sorted).length,
        processingTimeMs: processingTime,
        timestamp: Date.now(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache, 10 min stale
          ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
        },
      }
    )
  } catch (error) {
    console.error('Error fetching trending data:', error)
    
    // User-friendly error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred while fetching trending data.'
    
    return NextResponse.json(
      {
        error: 'Unable to load trending data at this time',
        message: 'We encountered an issue while fetching trending information. Please try again in a moment.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        trending: {},
        timestamp: Date.now(),
      },
      { 
        status: 200, // Return 200 with empty data for better UX
        headers: {
          'Cache-Control': 'public, s-maxage=60',
          ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
        }
      }
    )
  }
}

