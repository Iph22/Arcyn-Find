import type { AIEntry } from './ai-data'

export interface SimilarTool {
  tool: AIEntry
  similarityScore: number
  reasons: string[]
}

/**
 * Find similar/alternative tools based on multiple factors:
 * - Same category (high weight)
 * - Shared tags (medium weight)
 * - Same access type (low weight)
 * - Similar description keywords (low weight)
 */
export function findSimilarTools(
  targetTool: AIEntry,
  allTools: AIEntry[],
  maxResults: number = 5
): SimilarTool[] {
  const similar: SimilarTool[] = []

  for (const tool of allTools) {
    // Skip the target tool itself
    if (tool.id === targetTool.id) continue

    let similarityScore = 0
    const reasons: string[] = []

    // 1. Category match (highest weight: 50 points)
    if (tool.category.toLowerCase() === targetTool.category.toLowerCase()) {
      similarityScore += 50
      reasons.push('Same category')
    }

    // 2. Shared tags (medium weight: 10 points per tag, max 40 points)
    const sharedTags = tool.tags.filter(tag =>
      targetTool.tags.some(targetTag =>
        targetTag.toLowerCase() === tag.toLowerCase()
      )
    )
    if (sharedTags.length > 0) {
      const tagScore = Math.min(sharedTags.length * 10, 40)
      similarityScore += tagScore
      reasons.push(`${sharedTags.length} shared tag${sharedTags.length > 1 ? 's' : ''}`)
    }

    // 3. Same access type (low weight: 5 points)
    if (tool.accessType === targetTool.accessType) {
      similarityScore += 5
      reasons.push('Same pricing model')
    }

    // 4. Description keyword overlap (low weight: up to 10 points)
    const targetKeywords = extractKeywords(targetTool.description)
    const toolKeywords = extractKeywords(tool.description)
    const commonKeywords = targetKeywords.filter(kw =>
      toolKeywords.some(tk => tk.toLowerCase() === kw.toLowerCase())
    )
    if (commonKeywords.length > 0) {
      const keywordScore = Math.min(commonKeywords.length * 2, 10)
      similarityScore += keywordScore
      if (commonKeywords.length >= 2) {
        reasons.push('Similar features')
      }
    }

    // 5. Popularity boost (very low weight: up to 5 points)
    // More popular tools get a slight boost
    if (tool.popularity > 70) {
      similarityScore += 2
    }
    if (tool.isTrending) {
      similarityScore += 3
    }

    // Only include tools with meaningful similarity
    if (similarityScore > 0) {
      similar.push({
        tool,
        similarityScore,
        reasons: reasons.slice(0, 2), // Limit to top 2 reasons
      })
    }
  }

  // Sort by similarity score (descending) and popularity (descending)
  similar.sort((a, b) => {
    if (b.similarityScore !== a.similarityScore) {
      return b.similarityScore - a.similarityScore
    }
    return b.tool.popularity - a.tool.popularity
  })

  return similar.slice(0, maxResults)
}

/**
 * Extract meaningful keywords from description
 */
function extractKeywords(description: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'ai', 'tool', 'platform', 'service', 'application', 'app', 'system',
    'using', 'use', 'used', 'uses', 'help', 'helps', 'helping', 'create',
    'creates', 'creating', 'generates', 'generate', 'generating'
  ])

  return description
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10) // Limit to 10 keywords
}

/**
 * Find alternative tools (tools in same category but different from target)
 * Useful for "Alternatives to X" searches
 */
export function findAlternatives(
  targetTool: AIEntry,
  allTools: AIEntry[],
  maxResults: number = 5
): AIEntry[] {
  const alternatives = allTools.filter(tool => {
    // Must be in same category
    if (tool.category.toLowerCase() !== targetTool.category.toLowerCase()) {
      return false
    }
    // Must not be the same tool
    if (tool.id === targetTool.id) {
      return false
    }
    return true
  })

  // Sort by popularity and trending status
  alternatives.sort((a, b) => {
    if (b.isTrending !== a.isTrending) {
      return b.isTrending ? 1 : -1
    }
    return b.popularity - a.popularity
  })

  return alternatives.slice(0, maxResults)
}

