import { AIEntry } from './ai-data'

const VIEWS_STORAGE_KEY = 'arcyn-find-views'
const TRENDING_CACHE_KEY = 'arcyn-find-online-trending'
const TRENDING_CACHE_DURATION = 2 * 60 * 1000 // 2 minutes cache for real-time updates
const TRENDING_WINDOW_HOURS = 24 // Trending based on last 24 hours for more real-time

interface ViewRecord {
  aiId: string
  timestamp: number
}

interface OnlineTrendingData {
  [aiName: string]: number // AI name -> trending score
  timestamp: number
}

/**
 * Track a view/click on an AI tool and update popularity in real-time
 */
export function trackAIView(aiId: string): void {
  if (typeof window === 'undefined') return
  
  try {
    // Store view locally for trending calculation
    const views = getViews()
    views.push({
      aiId,
      timestamp: Date.now(),
    })
    
    // Keep only views from the last 7 days to prevent storage bloat
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    const recentViews = views.filter(v => v.timestamp > sevenDaysAgo)
    
    localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(recentViews))
    
    // Update popularity in real-time via API (fire and forget)
    fetch('/api/track-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ aiId }),
    }).catch(error => {
      // Silently fail - popularity update is not critical
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to update popularity:', error)
      }
    })
  } catch (error) {
    console.error('Failed to track view:', error)
  }
}

/**
 * Get all view records
 */
function getViews(): ViewRecord[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(VIEWS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Calculate trending score for an AI tool based on recent views
 */
function calculateLocalTrendingScore(aiId: string, views: ViewRecord[]): number {
  const trendingWindow = Date.now() - (TRENDING_WINDOW_HOURS * 60 * 60 * 1000)
  const recentViews = views.filter(v => v.aiId === aiId && v.timestamp > trendingWindow)
  
  // Score based on number of views in trending window (weighted by recency)
  let score = 0
  const now = Date.now()
  
  recentViews.forEach(view => {
    const hoursAgo = (now - view.timestamp) / (60 * 60 * 1000)
    // Recent views (last 6 hours) get full weight, older views get less
    const weight = Math.max(0, 1 - (hoursAgo / TRENDING_WINDOW_HOURS))
    score += weight
  })
  
  return score
}

/**
 * Fetch trending AI tools from GitHub
 */
async function fetchGitHubTrending(): Promise<Record<string, number>> {
  try {
    // Fetch trending repositories related to AI
    const response = await fetch('https://api.github.com/search/repositories?q=stars:>1000+language:python+AI+OR+machine-learning+OR+deep-learning&sort=stars&order=desc&per_page=20', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    })
    
    if (!response.ok) return {}
    
    const data = await response.json()
    const trending: Record<string, number> = {}
    
    // Map GitHub repos to AI tool names (simplified matching)
    data.items?.forEach((repo: any, index: number) => {
      const name = repo.name.toLowerCase()
      // Score based on position and stars (higher = more trending)
      const score = (20 - index) * 2 + Math.min(repo.stargazers_count / 1000, 10)
      trending[name] = score
    })
    
    return trending
  } catch (error) {
    console.error('Failed to fetch GitHub trending:', error)
    return {}
  }
}

/**
 * Fetch real-time trending data from scraping API
 */
async function fetchRealTimeTrending(): Promise<Record<string, number>> {
  try {
    const response = await fetch('/api/trending', {
      cache: 'no-store', // Always fetch fresh data
    })
    
    if (!response.ok) {
      console.warn('Trending API returned non-OK status:', response.status)
      return {}
    }
    
    const data = await response.json()
    return data.trending || {}
  } catch (error) {
    console.error('Failed to fetch real-time trending:', error)
    return {}
  }
}

/**
 * Get online trending data (cached)
 */
async function getOnlineTrendingData(): Promise<Record<string, number>> {
  if (typeof window === 'undefined') return {}
  
  try {
    // Check cache first (reduced to 5 minutes for more real-time data)
    const cached = localStorage.getItem(TRENDING_CACHE_KEY)
    if (cached) {
      const cachedData: OnlineTrendingData = JSON.parse(cached)
      const now = Date.now()
      
      // Return cached data if still fresh (2 minutes for real-time updates)
      if (cachedData.timestamp && (now - cachedData.timestamp) < 2 * 60 * 1000) {
        const { timestamp, ...trending } = cachedData
        return trending
      }
    }
    
    // Fetch fresh data from real-time scraping API
    const realTimeTrending = await fetchRealTimeTrending()
    
    // Also get GitHub trending as backup/fallback
    const githubTrending = await fetchGitHubTrending()
    
    // Combine: real-time scraping (80%) + GitHub (20%)
    const combinedTrending: Record<string, number> = {}
    
    // Add real-time trending with higher weight
    Object.entries(realTimeTrending).forEach(([name, score]) => {
      combinedTrending[name] = (score as number) * 0.8
    })
    
    // Add GitHub trending with lower weight (as backup)
    Object.entries(githubTrending).forEach(([name, score]) => {
      if (combinedTrending[name]) {
        combinedTrending[name] += (score as number) * 0.2
      } else {
        combinedTrending[name] = (score as number) * 0.2
      }
    })
    
    // Cache the result
    const cacheData: OnlineTrendingData = {
      ...combinedTrending,
      timestamp: Date.now(),
    }
    localStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify(cacheData))
    
    return combinedTrending
  } catch (error) {
    console.error('Failed to get online trending data:', error)
    // Return empty object on error (will fall back to local views only)
    return {}
  }
}

/**
 * Calculate similarity between two strings (Levenshtein-based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  // Check for exact match
  if (str1 === str2) return 1.0
  
  // Check for substring match
  if (longer.includes(shorter)) return 0.8
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(str1, str2)
  const maxLength = Math.max(str1.length, str2.length)
  
  return 1 - (distance / maxLength)
}

/**
 * Simple Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  const len1 = str1.length
  const len2 = str2.length

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[len2][len1]
}

/**
 * Match AI tool name to trending data (advanced fuzzy matching)
 */
function matchToTrendingData(aiName: string, trendingData: Record<string, number>): number {
  const normalizedName = aiName.toLowerCase().trim()
  
  // Direct match
  if (trendingData[normalizedName]) {
    return trendingData[normalizedName]
  }
  
  // Generate name variations
  const nameVariations = [
    normalizedName,
    normalizedName.replace(/\s+/g, '-'),
    normalizedName.replace(/\s+/g, ''),
    normalizedName.replace(/-/g, ''),
    normalizedName.replace(/-/g, ' '),
    normalizedName.replace(/\s+/g, ''),
    // Remove common prefixes/suffixes
    normalizedName.replace(/^(the|a|an)\s+/i, ''),
    normalizedName.replace(/\s+(ai|gpt|llm|tool|assistant|platform)$/i, ''),
  ].filter(v => v.length > 0)
  
  let bestMatch: { name: string; score: number; similarity: number } | null = null
  
  // Check all trending names for matches
  for (const [trendingName, trendingScore] of Object.entries(trendingData)) {
    const normalizedTrending = trendingName.toLowerCase().trim()
    
    // Check variations
    for (const variation of nameVariations) {
      // Exact match
      if (variation === normalizedTrending) {
        return trendingScore
      }
      
      // Calculate similarity
      const similarity = calculateSimilarity(variation, normalizedTrending)
      
      // If similarity is high enough, consider it a match
      if (similarity > 0.7) {
        const adjustedScore = trendingScore * similarity
        if (!bestMatch || adjustedScore > bestMatch.score) {
          bestMatch = {
            name: trendingName,
            score: adjustedScore,
            similarity,
          }
        }
      }
      
      // Check for substring matches (e.g., "copilot" in "github-copilot")
      if (variation.length >= 4 && normalizedTrending.length >= 4) {
        if (variation.includes(normalizedTrending) || normalizedTrending.includes(variation)) {
          const substringScore = trendingScore * 0.75
          if (!bestMatch || substringScore > bestMatch.score) {
            bestMatch = {
              name: trendingName,
              score: substringScore,
              similarity: 0.75,
            }
          }
        }
      }
    }
  }
  
  return bestMatch ? bestMatch.score : 0
}

/**
 * Get trending AI tools based on local views and online trending data
 */
export async function getTrendingAIs(aiModels: AIEntry[], limit: number = 3): Promise<AIEntry[]> {
  const views = getViews()
  const onlineTrending = await getOnlineTrendingData()
  
  // Calculate scores for all AIs
  const aiScores = aiModels.map(ai => {
    const localScore = calculateLocalTrendingScore(ai.id, views)
    const onlineScore = matchToTrendingData(ai.name, onlineTrending)
    
    // Combine scores: 30% local views, 70% online trending (prioritize real-time online trends)
    const combinedTrendingScore = (localScore * 0.3) + (onlineScore * 0.7)
    
    return {
      ai,
      localScore,
      onlineScore,
      trendingScore: combinedTrendingScore,
      popularity: ai.popularity,
    }
  })
  
  // Sort by trending score (primary) and popularity (secondary)
  aiScores.sort((a, b) => {
    // If both have trending activity, prioritize trending score
    if (b.trendingScore > 0 || a.trendingScore > 0) {
      if (Math.abs(b.trendingScore - a.trendingScore) > 0.1) {
        return b.trendingScore - a.trendingScore
      }
    }
    // Fallback to popularity
    return b.popularity - a.popularity
  })
  
  // Ensure diversity by selecting from different categories
  const categoryMap = new Map<string, typeof aiScores[0]>()
  const diverseTrending: AIEntry[] = []
  
  // First pass: get top trending from each category
  for (const scoreData of aiScores) {
    if (diverseTrending.length >= limit) break
    
    const category = scoreData.ai.category
    const existing = categoryMap.get(category)
    
    if (!existing || existing.trendingScore < scoreData.trendingScore) {
      categoryMap.set(category, scoreData)
    }
  }
  
  // Add top item from each category
  const sortedCategories = Array.from(categoryMap.entries()).sort(
    (a, b) => b[1].trendingScore - a[1].trendingScore
  )
  
  for (const [, scoreData] of sortedCategories) {
    if (diverseTrending.length >= limit) break
    diverseTrending.push(scoreData.ai)
  }
  
  // If we still need more, fill with highest trending remaining items
  if (diverseTrending.length < limit) {
    const remaining = aiScores
      .filter(({ ai }) => !diverseTrending.includes(ai))
      .slice(0, limit - diverseTrending.length)
      .map(({ ai }) => ai)
    
    diverseTrending.push(...remaining)
  }
  
  return diverseTrending.slice(0, limit)
}

