import { AIEntry } from './ai-data'

/**
 * Calculate Levenshtein distance for fuzzy matching
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
 * Check if two strings match with fuzzy tolerance
 */
function fuzzyMatch(text: string, query: string, threshold: number = 0.7): boolean {
  const normalizedText = text.toLowerCase()
  const normalizedQuery = query.toLowerCase()

  // Exact match
  if (normalizedText.includes(normalizedQuery)) {
    return true
  }

  // Fuzzy match using Levenshtein distance
  const maxDistance = Math.floor(normalizedQuery.length * (1 - threshold))
  const distance = levenshteinDistance(normalizedText, normalizedQuery)
  
  return distance <= maxDistance
}

/**
 * Parse advanced search operators
 * Supports: tag:, category:, region:, access:, AND, OR, NOT
 */
export interface ParsedQuery {
  text: string
  tags: string[]
  category?: string
  region?: string
  accessType?: string
  operators: {
    and: boolean
    or: boolean
    not: string[]
  }
}

export function parseSearchQuery(query: string): ParsedQuery {
  const result: ParsedQuery = {
    text: '',
    tags: [],
    operators: {
      and: false,
      or: false,
      not: [],
    },
  }

  // Extract operators
  const tagMatch = query.match(/tag:(\w+)/gi)
  if (tagMatch) {
    result.tags = tagMatch.map((m) => m.replace(/tag:/gi, '').trim())
  }

  const categoryMatch = query.match(/category:(\w+)/gi)
  if (categoryMatch) {
    result.category = categoryMatch[0].replace(/category:/gi, '').trim()
  }

  const regionMatch = query.match(/region:(\w+)/gi)
  if (regionMatch) {
    result.region = regionMatch[0].replace(/region:/gi, '').trim()
  }

  const accessMatch = query.match(/access:(free|freemium|paid)/gi)
  if (accessMatch) {
    result.accessType = accessMatch[0].replace(/access:/gi, '').trim()
  }

  // Extract NOT operators
  const notMatches = query.match(/not:(\w+)/gi)
  if (notMatches) {
    result.operators.not = notMatches.map((m) => m.replace(/not:/gi, '').trim())
  }

  // Check for AND/OR operators
  result.operators.and = /\bAND\b/i.test(query)
  result.operators.or = /\bOR\b/i.test(query)

  // Extract remaining text (remove operators)
  result.text = query
    .replace(/tag:\w+/gi, '')
    .replace(/category:\w+/gi, '')
    .replace(/region:\w+/gi, '')
    .replace(/access:(free|freemium|paid)/gi, '')
    .replace(/not:\w+/gi, '')
    .replace(/\bAND\b/gi, '')
    .replace(/\bOR\b/gi, '')
    .trim()

  return result
}

/**
 * Calculate relevance score for a search result
 */
function calculateRelevanceScore(ai: AIEntry, parsedQuery: ParsedQuery, query: string): number {
  let score = 0
  const normalizedQuery = query.toLowerCase()
  const normalizedName = ai.name.toLowerCase()
  const normalizedDesc = ai.description.toLowerCase()

  // Exact name match (highest priority)
  if (normalizedName === normalizedQuery) {
    score += 100
  } else if (normalizedName.startsWith(normalizedQuery)) {
    score += 80
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 60
  }

  // Description match
  if (normalizedDesc.includes(normalizedQuery)) {
    score += 30
  }

  // Tag matches
  const matchingTags = ai.tags.filter((tag) =>
    tag.toLowerCase().includes(normalizedQuery) ||
    normalizedQuery.includes(tag.toLowerCase())
  )
  score += matchingTags.length * 20

  // Fuzzy match bonus
  if (fuzzyMatch(ai.name, query, 0.7)) {
    score += 10
  }

  // Popularity boost
  score += ai.popularity * 0.1

  // Trending boost
  if (ai.isTrending) {
    score += 15
  }

  // Operator-specific scoring
  if (parsedQuery.tags.length > 0) {
    const tagMatches = parsedQuery.tags.filter((tag) =>
      ai.tags.some((aiTag) => aiTag.toLowerCase().includes(tag.toLowerCase()))
    )
    score += tagMatches.length * 25
  }

  if (parsedQuery.category && ai.category.toLowerCase() === parsedQuery.category.toLowerCase()) {
    score += 40
  }

  return score
}

/**
 * Search and filter AI entries with all enhancements
 */
export function searchAIEntries(
  entries: AIEntry[],
  query: string,
  filters: {
    category?: string
    region?: string
    accessType?: string
  }
): { results: AIEntry[]; scores: Map<string, number> } {
  if (!query.trim() && !filters.category && !filters.region && !filters.accessType) {
    return { results: entries, scores: new Map() }
  }

  const parsedQuery = parseSearchQuery(query)
  const scores = new Map<string, number>()
  const results: AIEntry[] = []

  for (const ai of entries) {
    let matches = true
    let score = 0

    // Apply text search
    if (parsedQuery.text) {
      const textMatches =
        fuzzyMatch(ai.name, parsedQuery.text, 0.7) ||
        fuzzyMatch(ai.description, parsedQuery.text, 0.7) ||
        ai.tags.some((tag) => fuzzyMatch(tag, parsedQuery.text, 0.7))

      if (!textMatches && !parsedQuery.operators.or) {
        matches = false
      } else if (textMatches) {
        score = calculateRelevanceScore(ai, parsedQuery, parsedQuery.text)
      }
    }

    // Apply operator filters
    if (parsedQuery.tags.length > 0) {
      const tagMatches = parsedQuery.tags.some((tag) =>
        ai.tags.some((aiTag) => aiTag.toLowerCase().includes(tag.toLowerCase()))
      )
      if (parsedQuery.operators.and && !tagMatches) {
        matches = false
      } else if (tagMatches) {
        score += 25
      }
    }

    if (parsedQuery.category && ai.category.toLowerCase() !== parsedQuery.category.toLowerCase()) {
      if (parsedQuery.operators.and) {
        matches = false
      }
    }

    if (parsedQuery.region && ai.region.toLowerCase() !== parsedQuery.region.toLowerCase()) {
      if (parsedQuery.operators.and) {
        matches = false
      }
    }

    if (parsedQuery.accessType && ai.accessType.toLowerCase() !== parsedQuery.accessType.toLowerCase()) {
      if (parsedQuery.operators.and) {
        matches = false
      }
    }

    // Apply NOT operators
    if (parsedQuery.operators.not.some((notTerm) => 
      ai.name.toLowerCase().includes(notTerm.toLowerCase()) ||
      ai.description.toLowerCase().includes(notTerm.toLowerCase())
    )) {
      matches = false
    }

    // Apply regular filters
    if (filters.category && ai.category !== filters.category) {
      matches = false
    }
    if (filters.region && ai.region !== filters.region) {
      matches = false
    }
    if (filters.accessType && ai.accessType !== filters.accessType) {
      matches = false
    }

    if (matches) {
      scores.set(ai.id, score)
      results.push(ai)
    }
  }

  // Sort by relevance score
  results.sort((a, b) => {
    const scoreA = scores.get(a.id) || 0
    const scoreB = scores.get(b.id) || 0
    return scoreB - scoreA
  })

  return { results, scores }
}

/**
 * Generate search suggestions based on query
 */
export function generateSuggestions(
  entries: AIEntry[],
  query: string,
  maxSuggestions: number = 5
): string[] {
  if (!query.trim()) {
    return []
  }

  const normalizedQuery = query.toLowerCase()
  const suggestions = new Set<string>()

  // Suggest from names
  entries.forEach((ai) => {
    if (fuzzyMatch(ai.name, query, 0.6)) {
      suggestions.add(ai.name)
    }
  })

  // Suggest from tags
  entries.forEach((ai) => {
    ai.tags.forEach((tag) => {
      if (fuzzyMatch(tag, query, 0.6)) {
        suggestions.add(tag)
      }
    })
  })

  // Suggest categories
  const categories = Array.from(new Set(entries.map((ai) => ai.category)))
  categories.forEach((category) => {
    if (fuzzyMatch(category, query, 0.6)) {
      suggestions.add(category)
    }
  })

  return Array.from(suggestions).slice(0, maxSuggestions)
}

/**
 * Search history management
 */
const SEARCH_HISTORY_KEY = 'arcyn-find-search-history'
const MAX_HISTORY_ITEMS = 10

export function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  
  try {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY)
    return history ? JSON.parse(history) : []
  } catch {
    return []
  }
}

export function addToSearchHistory(query: string): void {
  if (typeof window === 'undefined' || !query.trim()) return

  try {
    const history = getSearchHistory()
    // Remove if already exists
    const filtered = history.filter((q) => q.toLowerCase() !== query.toLowerCase())
    // Add to front
    const updated = [query, ...filtered].slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
  } catch {
    // Ignore errors
  }
}

export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  } catch {
    // Ignore errors
  }
}

