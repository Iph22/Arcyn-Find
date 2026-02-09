/**
 * Search Utilities - Google-like search improvements
 * 
 * Features:
 * - Stop word removal
 * - Synonym expansion
 * - Query normalization
 * - Fuzzy matching preparation
 */

// Common stop words to remove from searches
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'to', 'from', 'for', 'with', 'in', 'on', 'at', 'by', 'of', 'about',
  'that', 'which', 'who', 'whom', 'this', 'these', 'those',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
  'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'not', 'only', 'same', 'so', 'than', 'too', 'very', 'just', 'can',
  'want', 'need', 'looking', 'find', 'search', 'help', 'please', 'get', 'make',
  'tool', 'tools', 'app', 'apps', 'use', 'using', 'used'
])

// Synonym mappings for query expansion
const SYNONYMS: Record<string, string[]> = {
  // Document types
  'powerpoint': ['presentation', 'ppt', 'slides', 'slideshow', 'deck'],
  'presentation': ['powerpoint', 'ppt', 'slides', 'slideshow', 'deck'],
  'pdf': ['document', 'doc', 'file'],
  'word': ['document', 'doc', 'docx', 'text'],
  'excel': ['spreadsheet', 'csv', 'xls', 'xlsx', 'data'],
  'spreadsheet': ['excel', 'csv', 'xls', 'xlsx', 'data'],

  // Actions
  'summarize': ['summary', 'summarization', 'condense', 'shorten', 'tldr', 'digest'],
  'summary': ['summarize', 'summarization', 'condense', 'shorten', 'tldr'],
  'convert': ['transform', 'change', 'translate', 'export'],
  'generate': ['create', 'make', 'produce', 'build'],
  'create': ['generate', 'make', 'produce', 'build'],
  'edit': ['modify', 'change', 'update', 'revise'],
  'analyze': ['analysis', 'examine', 'study', 'parse'],
  'transcribe': ['transcription', 'speech-to-text', 'caption'],
  'translate': ['translation', 'language', 'interpret'],

  // AI tasks
  'chatbot': ['chat', 'assistant', 'conversational', 'gpt'],
  'image': ['picture', 'photo', 'visual', 'graphic', 'art'],
  'video': ['clip', 'movie', 'footage', 'animation'],
  'audio': ['sound', 'voice', 'music', 'speech'],
  'write': ['writing', 'content', 'copy', 'text', 'compose'],
  'code': ['coding', 'programming', 'developer', 'software'],
  'automation': ['automate', 'automatic', 'workflow', 'bot'],

  // Domains
  'marketing': ['advertising', 'ads', 'promotion', 'seo', 'social-media'],
  'design': ['ui', 'ux', 'graphic', 'visual', 'creative'],
  'research': ['study', 'academic', 'paper', 'analysis'],
  'education': ['learning', 'study', 'teach', 'course', 'training'],
  'productivity': ['efficiency', 'workflow', 'task', 'organization'],
}

// Common typos and corrections
const TYPO_CORRECTIONS: Record<string, string> = {
  'summarise': 'summarize',
  'summerize': 'summarize',
  'sumarize': 'summarize',
  'pwoerpoint': 'powerpoint',
  'powerpint': 'powerpoint',
  'powerpiont': 'powerpoint',
  'presnetation': 'presentation',
  'presentaiton': 'presentation',
  'documnet': 'document',
  'docuemnt': 'document',
  'anaylze': 'analyze',
  'analysie': 'analyze',
  'generat': 'generate',
  'trascribe': 'transcribe',
  'transalte': 'translate',
  'marketting': 'marketing',
  'desing': 'design',
}

/**
 * Normalize and clean a search query
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') // Remove special characters except hyphens
    .replace(/\s+/g, ' ')      // Collapse multiple spaces
    .trim()
}

/**
 * Correct common typos in a query
 */
export function correctTypos(query: string): string {
  const words = query.split(/\s+/)
  return words.map(word => TYPO_CORRECTIONS[word] || word).join(' ')
}

/**
 * Remove stop words from a query
 */
export function removeStopWords(query: string): string[] {
  return query
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
}

/**
 * Expand a query with synonyms
 */
export function expandWithSynonyms(words: string[]): string[] {
  const expanded = new Set(words)

  for (const word of words) {
    const synonyms = SYNONYMS[word]
    if (synonyms) {
      // Add first 2 most relevant synonyms to avoid over-expansion
      synonyms.slice(0, 2).forEach(syn => expanded.add(syn))
    }
  }

  return Array.from(expanded)
}

/**
 * Calculate similarity between two strings (for fuzzy matching)
 * Uses Levenshtein distance ratio
 */
export function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1.0

  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2[i - 1] === str1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

/**
 * Process a search query with all enhancements
 * Returns an object with original query, processed keywords, and expanded terms
 */
export interface ProcessedQuery {
  original: string
  normalized: string
  keywords: string[]       // Main keywords after stop word removal
  expanded: string[]       // Keywords + synonyms
  typosCorrected: boolean
}

export function processSearchQuery(query: string): ProcessedQuery {
  const original = query
  let normalized = normalizeQuery(query)

  // Check and correct typos
  const corrected = correctTypos(normalized)
  const typosCorrected = corrected !== normalized
  if (typosCorrected) {
    normalized = corrected
  }

  // Remove stop words
  const keywords = removeStopWords(normalized)

  // Expand with synonyms
  const expanded = expandWithSynonyms(keywords)

  return {
    original,
    normalized,
    keywords,
    expanded,
    typosCorrected
  }
}

/**
 * Build a PostgreSQL full-text search query string
 */
export function buildTsQuery(keywords: string[]): string {
  if (keywords.length === 0) return ''

  // Join with OR operator and add prefix matching
  return keywords
    .map(word => `${word}:*`) // Prefix matching
    .join(' | ')
}

/**
 * Build Supabase OR conditions for search
 */
export function buildSearchConditions(expanded: string[]): string {
  const conditions: string[] = []

  for (const word of expanded) {
    conditions.push(`name.ilike.%${word}%`)
    conditions.push(`description.ilike.%${word}%`)
    conditions.push(`tags.cs.{${word}}`)
  }

  return conditions.join(',')
}
