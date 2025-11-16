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
 * Normalize category names to handle variations
 */
export function normalizeCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    "NLP/Audio": "Audio/NLP",
    "nlp/audio": "Audio/NLP",
    "NLP / Audio": "Audio/NLP",
    "nlp / audio": "Audio/NLP",
  }
  
  return categoryMap[category] || category
}

/**
 * Extract keywords and intent from natural language queries
 * Enhanced version with better sentence parsing and comprehensive category mapping
 */
function extractKeywordsFromNaturalLanguage(query: string): {
  keywords: string[]
  categories: string[]
  tags: string[]
} {
  const normalized = query.toLowerCase()
  const keywords: string[] = []
  const categories: string[] = []
  const tags: string[] = []
  
  // Comprehensive category mappings - map natural language to categories
  const categoryKeywords: Record<string, string[]> = {
    "Generative AI": [
      "chat", "conversation", "chatbot", "chat bot", "writing", "content", 
      "text generation", "generate text", "assistant", "ai chat", "llm", 
      "language model", "gpt", "claude", "gemini", "bard", "text ai",
      "conversational ai", "dialogue", "qa", "question answering", "answer questions"
    ],
    "Code Generation": [
      "code", "coding", "programming", "developer", "development", "software", 
      "program", "script", "generate code", "code generation", "code generator", 
      "code completion", "autocomplete code", "ai code", "code assistant",
      "copilot", "pair programming", "code review", "debug", "debugging",
      "refactor", "refactoring", "syntax", "function", "api", "sdk"
    ],
    "Computer Vision": [
      "image", "vision", "photo", "picture", "visual", "image generation", 
      "generate image", "create image", "art", "drawing", "painting", "illustration",
      "image recognition", "object detection", "face recognition", "facial recognition",
      "image classification", "image analysis", "computer vision", "cv", "opencv",
      "image editing", "photo editing", "image processing", "visual ai", "image ai"
    ],
    "Video Generation": [
      "video editing", "edit video", "video generation", "video creation", 
      "video production", "video maker", "video ai", "generate video", 
      "create video", "video synthesis", "video effects", "video enhancement", 
      "video upscaling", "video compression", "video converter",
      "video edit", "editing video", "edit my video", "video editor",
      "video", "edit", "editing", "produce", "production", "generate", "creation"
    ],
    "Audio/NLP": [
      "audio", "speech", "voice", "sound", "transcribe", "transcription", 
      "tts", "text to speech", "speech to text", "stt", "voice recognition",
      "speech recognition", "voice synthesis", "audio generation", "audio editing",
      "audio processing", "voice cloning", "voice changer", "audio ai", "speech ai",
      "podcast", "audio transcription", "voice assistant", "audio analysis"
    ],
    "NLP Platform": [
      "nlp", "natural language", "language processing", "text processing",
      "sentiment analysis", "text analysis", "named entity", "ner", "pos tagging",
      "language model", "text mining", "text extraction", "language understanding",
      "nlp platform", "text analytics", "language ai"
    ],
    "Search/QA": [
      "search", "search engine", "question answering", "qa", "answer questions",
      "information retrieval", "semantic search", "vector search", "search ai",
      "ask questions", "find information", "search tool", "search assistant",
      "knowledge base", "document search", "web search"
    ],
    "ML Infrastructure": [
      "ml", "machine learning", "infrastructure", "mlops", "model training",
      "model deployment", "model hosting", "ml platform", "ai platform",
      "model management", "feature store", "data pipeline", "training platform",
      "inference", "model serving", "ml framework", "deep learning", "neural network"
    ],
    "Autonomous AI": [
      "autonomous", "agent", "ai agent", "autonomous agent", "ai automation",
      "task automation", "workflow automation", "ai robot", "autonomous system",
      "self-learning", "adaptive ai", "intelligent agent"
    ],
    "Multimodal Platform": [
      "multimodal", "multi-modal", "multiple modalities", "text and image",
      "text and video", "text and audio", "combined ai", "unified platform",
      "multi format", "cross-modal", "multimedia ai"
    ],
    "Audio/Video Processing": [
      "audio video", "audio and video", "multimedia", "media processing",
      "streaming", "video audio", "media editing", "media conversion",
      "media analysis", "media ai"
    ]
  }
  
  // Enhanced tag mappings
  const tagKeywords: Record<string, string[]> = {
    "code-assistant": ["code", "coding", "programming", "developer", "development", "copilot"],
    "code-generation": ["generate code", "code generation", "code generator", "code completion", "autocomplete"],
    "video-editing": [
      "video editing", "edit video", "video edit", "editing video", 
      "edit my video", "video production", "video effects", "video editor",
      "edit", "editing", "video"
    ],
    "image-generation": ["image", "generate image", "create image", "art", "drawing", "picture", "photo"],
    "speech-to-text": ["speech", "transcribe", "transcription", "voice to text", "speech recognition", "stt"],
    "text-to-speech": ["tts", "voice", "speak", "audio generation", "text to speech", "voice synthesis"],
    "chatbot": ["chat", "chatbot", "conversation", "dialogue", "assistant"],
    "search": ["search", "find", "lookup", "retrieve", "information"],
    "ml-platform": ["ml", "machine learning", "mlops", "training", "deployment"]
  }
  
  // Enhanced sentence parsing - extract keywords from full sentences
  // Check for multi-word phrases first (longer matches take priority)
  const sortedCategories = Object.entries(categoryKeywords).sort((a, b) => {
    // Sort by longest keyword first to match phrases before single words
    const maxLenA = Math.max(...a[1].map(k => k.length))
    const maxLenB = Math.max(...b[1].map(k => k.length))
    return maxLenB - maxLenA
  })
  
  // Extract category matches with priority for longer phrases
  for (const [category, keywords] of sortedCategories) {
    // Check if any keyword phrase matches (case-insensitive, word boundary aware)
    const matched = keywords.some(kw => {
      // For multi-word phrases, check if all words appear in order with closer proximity
      if (kw.includes(' ')) {
        const words = kw.split(' ')
        // More strict: words should appear in order with max 3 words between them
        // This prevents "help me edit my video" from matching "help" alone
        const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        // Build regex: first word, then up to 3 words, then second word, etc.
        const regexPattern = escapedWords.map((w, idx) => {
          if (idx === 0) return `\\b${w}\\b`
          // Allow up to 3 words between each keyword word
          return `(?:\\s+\\w+){0,3}\\s+\\b${w}\\b`
        }).join('')
        const regex = new RegExp(regexPattern, 'i')
        return regex.test(normalized)
      } else {
        // Single word - use word boundary
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        return regex.test(normalized)
      }
    })
    
    if (matched && !categories.includes(category)) {
      categories.push(category)
    }
  }
  
  // Extract tag matches
  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    const matched = keywords.some(kw => {
      if (kw.includes(' ')) {
        const words = kw.split(' ')
        const regex = new RegExp(words.map(w => `\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).join('.*'), 'i')
        return regex.test(normalized)
      } else {
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        return regex.test(normalized)
      }
    })
    
    if (matched && !tags.includes(tag)) {
      tags.push(tag)
    }
  }
  
  // Extract common action words and remove them (comprehensive list)
  const actionWords = [
    "want", "wants", "wanted", "need", "needs", "needed", 
    "looking for", "look for", "find", "finds", "finding", "found",
    "help me with", "help me", "can help", "helps", "help", "helping", "helped",
    "that can", "which can", "that will", "which will",
    "for", "an ai", "a tool", "tools", "tool", "ai", "a", "an", "the",
    "i", "me", "my", "myself", "we", "us", "our", "ourselves",
    "with", "to", "from", "in", "on", "at", "by", "for", "of", "about",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "done", "doing", "will", "would", "should", "could", "may", "might",
    "get", "gets", "getting", "got", "gotten", "make", "makes", "making", "made",
    "create", "creates", "creating", "created", "use", "uses", "using", "used",
    "work", "works", "working", "worked", "show", "shows", "showing", "show me",
    "give", "gives", "giving", "gave", "given", "tell", "tells", "telling", "told"
  ]
  
  let cleanedQuery = normalized
  actionWords.forEach(word => {
    cleanedQuery = cleanedQuery.replace(new RegExp(`\\b${word}\\b`, 'gi'), ' ')
  })
  
  // Extract remaining meaningful keywords (2+ characters, not already in categories/tags)
  // Filter out generic/common words that don't add meaningful search intent
  const genericWords = [
    "help", "helps", "helping", "helped", "get", "gets", "getting", "got",
    "make", "makes", "making", "made", "create", "creates", "creating", "created",
    "use", "uses", "using", "used", "work", "works", "working", "worked",
    "show", "shows", "showing", "show me", "give", "gives", "giving", "gave",
    "tell", "tells", "telling", "told", "see", "sees", "seeing", "saw",
    "know", "knows", "knowing", "knew", "known", "think", "thinks", "thinking", "thought"
  ]
  
  const words = cleanedQuery.split(/\s+/).filter(w => {
    if (w.length < 2) return false
    
    // Filter out generic words
    if (genericWords.includes(w.toLowerCase())) return false
    
    // Don't add if it's already matched as a category keyword
    const isCategoryKeyword = Object.values(categoryKeywords).some(kws => 
      kws.some(kw => {
        // Check if word is part of a multi-word keyword or exact match
        if (kw.includes(' ')) {
          return kw.split(' ').includes(w) || w === kw
        }
        return kw.includes(w) || w.includes(kw)
      })
    )
    return !isCategoryKeyword
  })
  
  keywords.push(...words)
  
  return { keywords, categories, tags }
}

/**
 * Parse advanced search operators
 * Supports: tag:, category:, region:, access:, AND, OR, NOT
 * Also supports natural language queries
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
  let remainingText = query
    .replace(/tag:\w+/gi, '')
    .replace(/category:\w+/gi, '')
    .replace(/region:\w+/gi, '')
    .replace(/access:(free|freemium|paid)/gi, '')
    .replace(/not:\w+/gi, '')
    .replace(/\bAND\b/gi, '')
    .replace(/\bOR\b/gi, '')
    .trim()

  // Check if this looks like a natural language query
  const isNaturalLanguage = /\b(want|need|looking for|help me|that can|for|i want|i need)\b/i.test(query) ||
                           (query.split(/\s+/).length > 3 && !result.category && !result.tags.length)
  
  if (isNaturalLanguage && remainingText) {
    const extracted = extractKeywordsFromNaturalLanguage(remainingText)
    
    // Add extracted categories to the query (if no explicit category was specified)
    if (extracted.categories.length > 0 && !result.category) {
      // For OR queries, we want to match any category
      if (result.operators.or && extracted.categories.length > 1) {
        // Store multiple categories for OR matching
        result.category = extracted.categories.join('|')
      } else {
        result.category = extracted.categories[0] // Use first matching category
      }
    }
    
    // Add extracted tags
    result.tags.push(...extracted.tags)
    
    // Use extracted keywords as the text query, or keep original if keywords are too generic
    if (extracted.keywords.length > 0 && extracted.keywords.some(kw => kw.length > 2)) {
      result.text = extracted.keywords.filter(kw => kw.length > 2).join(' ')
    } else {
      result.text = remainingText
    }
  } else {
    result.text = remainingText
  }

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

  // Category match
  const normalizedCategory = ai.category.toLowerCase()
  if (normalizedCategory === normalizedQuery) {
    score += 50
  } else if (normalizedCategory.includes(normalizedQuery)) {
    score += 35
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

    // Apply text search with improved keyword prioritization
    if (parsedQuery.text) {
      const queryWords = parsedQuery.text.toLowerCase().split(/\s+/).filter(w => w.length > 0)
      const normalizedText = parsedQuery.text.toLowerCase()
      
      // Filter out generic words from query words for matching
      const genericWords = [
        "help", "helps", "helping", "helped", "get", "gets", "getting", "got",
        "make", "makes", "making", "made", "create", "creates", "creating", "created",
        "use", "uses", "using", "used", "work", "works", "working", "worked",
        "show", "shows", "showing", "give", "gives", "giving", "tell", "tells", "telling"
      ]
      
      const meaningfulWords = queryWords.filter(w => !genericWords.includes(w) && w.length > 2)
      
      // Priority 1: Check if query matches category/tags (highest priority - most relevant)
      const categoryTagMatch = 
        fuzzyMatch(ai.category, normalizedText, 0.7) ||
        ai.tags.some((tag) => fuzzyMatch(tag, normalizedText, 0.7)) ||
        ai.tags.some(tag => {
          const tagLower = tag.toLowerCase()
          return tagLower.includes(normalizedText) || normalizedText.includes(tagLower)
        }) ||
        // Check if meaningful words match category/tags
        (meaningfulWords.length > 0 && meaningfulWords.some(word =>
          ai.category.toLowerCase().includes(word) ||
          ai.tags.some(tag => tag.toLowerCase().includes(word))
        ))
      
      // Priority 2: Check for exact phrase match in name/description
      const phraseMatches =
        fuzzyMatch(ai.name, parsedQuery.text, 0.7) ||
        fuzzyMatch(ai.description, parsedQuery.text, 0.7) ||
        ai.description.toLowerCase().includes(normalizedText) ||
        ai.description.toLowerCase().includes(normalizedText.split(' ').reverse().join(' ')) ||
        ai.tags.some(tag => {
          const tagLower = tag.toLowerCase()
          return tagLower.includes(normalizedText) || tagLower.includes(normalizedText.split(' ').reverse().join(' '))
        })
      
      // Priority 3: Check if meaningful words (not generic) match name/description
      const meaningfulWordsMatch = meaningfulWords.length > 0 && meaningfulWords.some(word =>
        ai.name.toLowerCase().includes(word) ||
        ai.description.toLowerCase().includes(word) ||
        ai.category.toLowerCase().includes(word) ||
        ai.tags.some(tag => tag.toLowerCase().includes(word))
      )
      
      // Priority 4: For multi-word queries, check if all meaningful words match
      const allMeaningfulWordsMatch = meaningfulWords.length > 1 && meaningfulWords.every(word =>
        fuzzyMatch(ai.name, word, 0.7) ||
        fuzzyMatch(ai.description, word, 0.7) ||
        fuzzyMatch(ai.category, word, 0.7) ||
        ai.tags.some((tag) => fuzzyMatch(tag, word, 0.7))
      )
      
      // Match if any priority level matches (but prioritize category/tag matches)
      const textMatches = categoryTagMatch || phraseMatches || meaningfulWordsMatch || allMeaningfulWordsMatch

      if (!textMatches && !parsedQuery.operators.or) {
        matches = false
      } else if (textMatches) {
        score = calculateRelevanceScore(ai, parsedQuery, parsedQuery.text)
        // Boost score significantly for category/tag matches (most relevant)
        if (categoryTagMatch) {
          score += 50
        }
        // Boost for phrase matches
        if (phraseMatches) {
          score += 30
        }
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

    if (parsedQuery.category) {
      // Normalize categories before matching
      const normalizedQueryCategory = normalizeCategory(parsedQuery.category)
      const normalizedAICategory = normalizeCategory(ai.category)
      
      // Handle OR category matching (categories joined with |)
      const categoryMatches = normalizedQueryCategory.includes('|')
        ? normalizedQueryCategory.split('|').some(cat => normalizeCategory(cat).toLowerCase() === normalizedAICategory.toLowerCase())
        : normalizedQueryCategory.toLowerCase() === normalizedAICategory.toLowerCase()
      
      if (!categoryMatches) {
        if (parsedQuery.operators.and) {
          matches = false
        }
      } else {
        score += 40
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

    // Apply regular filters (with category normalization)
    if (filters.category) {
      const normalizedFilterCategory = normalizeCategory(filters.category)
      const normalizedAICategory = normalizeCategory(ai.category)
      if (normalizedFilterCategory !== normalizedAICategory) {
        matches = false
      }
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
 * Search suggestion with type and metadata
 */
export interface SearchSuggestion {
  text: string
  type: 'tool' | 'tag' | 'category'
  tool?: AIEntry
  matchCount?: number
}

/**
 * Generate search suggestions based on query with enhanced metadata
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
  const categories = Array.from(new Set(entries.map((ai) => normalizeCategory(ai.category))))
  categories.forEach((category) => {
    if (fuzzyMatch(category, query, 0.6)) {
      suggestions.add(category)
    }
  })

  return Array.from(suggestions).slice(0, maxSuggestions)
}

/**
 * Generate enhanced search suggestions with metadata
 */
export function generateEnhancedSuggestions(
  entries: AIEntry[],
  query: string,
  maxSuggestions: number = 8
): SearchSuggestion[] {
  if (!query.trim()) {
    return []
  }

  const normalizedQuery = query.toLowerCase()
  const suggestions: SearchSuggestion[] = []
  const seen = new Set<string>()

  // Suggest tools with match count
  entries.forEach((ai) => {
    if (fuzzyMatch(ai.name, query, 0.6) && !seen.has(ai.name)) {
      seen.add(ai.name)
      suggestions.push({
        text: ai.name,
        type: 'tool',
        tool: ai,
        matchCount: 1
      })
    }
  })

  // Suggest tags with match count
  const tagCounts = new Map<string, number>()
  entries.forEach((ai) => {
    ai.tags.forEach((tag) => {
      if (fuzzyMatch(tag, query, 0.6)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    })
  })

  tagCounts.forEach((count, tag) => {
    if (!seen.has(tag)) {
      seen.add(tag)
      suggestions.push({
        text: tag,
        type: 'tag',
        matchCount: count
      })
    }
  })

  // Suggest categories with match count
  const categoryCounts = new Map<string, number>()
  entries.forEach((ai) => {
    const normalizedCategory = normalizeCategory(ai.category)
    if (fuzzyMatch(normalizedCategory, query, 0.6)) {
      categoryCounts.set(normalizedCategory, (categoryCounts.get(normalizedCategory) || 0) + 1)
    }
  })

  categoryCounts.forEach((count, category) => {
    if (!seen.has(category)) {
      seen.add(category)
      suggestions.push({
        text: category,
        type: 'category',
        matchCount: count
      })
    }
  })

  // Sort by relevance (tools first, then by match count)
  suggestions.sort((a, b) => {
    if (a.type === 'tool' && b.type !== 'tool') return -1
    if (a.type !== 'tool' && b.type === 'tool') return 1
    return (b.matchCount || 0) - (a.matchCount || 0)
  })

  return suggestions.slice(0, maxSuggestions)
}

/**
 * Highlight matches in text
 */
export function highlightMatches(text: string, query: string): string {
  if (!query.trim()) return text
  
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0)
  let highlighted = text
  
  words.forEach(word => {
    const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    highlighted = highlighted.replace(regex, '<mark>$1</mark>')
  })
  
  return highlighted
}

/**
 * Get autocomplete suggestion for partial query
 */
export function getAutocompleteSuggestion(query: string): string | null {
  if (!query.trim() || query.length < 2) return null
  
  const history = getSearchHistory()
  const normalizedQuery = query.toLowerCase()
  
  // Find matching history items
  const matches = history.filter(h => 
    h.toLowerCase().startsWith(normalizedQuery) && h.toLowerCase() !== normalizedQuery
  )
  
  if (matches.length > 0) {
    return matches[0]
  }
  
  return null
}

/**
 * Group search results by category
 */
export function groupResultsByCategory(results: AIEntry[]): Map<string, AIEntry[]> {
  const grouped = new Map<string, AIEntry[]>()
  
  results.forEach(ai => {
    const normalizedCategory = normalizeCategory(ai.category)
    if (!grouped.has(normalizedCategory)) {
      grouped.set(normalizedCategory, [])
    }
    grouped.get(normalizedCategory)!.push(ai)
  })
  
  return grouped
}

/**
 * Track search analytics
 */
const SEARCH_ANALYTICS_KEY = 'arcyn-find-search-analytics'

export interface SearchAnalytics {
  query: string
  resultCount: number
  timestamp: number
  hasResults: boolean
}

export function trackSearch(query: string, resultCount: number): void {
  if (typeof window === 'undefined' || !query.trim()) return
  
  try {
    const analytics: SearchAnalytics[] = JSON.parse(
      localStorage.getItem(SEARCH_ANALYTICS_KEY) || '[]'
    )
    
    analytics.push({
      query,
      resultCount,
      timestamp: Date.now(),
      hasResults: resultCount > 0
    })
    
    // Keep only last 100 searches
    const recent = analytics.slice(-100)
    localStorage.setItem(SEARCH_ANALYTICS_KEY, JSON.stringify(recent))
  } catch {
    // Ignore errors
  }
}

export function getSearchAnalytics(): SearchAnalytics[] {
  if (typeof window === 'undefined') return []
  
  try {
    return JSON.parse(localStorage.getItem(SEARCH_ANALYTICS_KEY) || '[]')
  } catch {
    return []
  }
}

export function getPopularSearches(limit: number = 5): string[] {
  const analytics = getSearchAnalytics()
  const queryCounts = new Map<string, number>()
  
  analytics.forEach(a => {
    if (a.hasResults) {
      queryCounts.set(a.query, (queryCounts.get(a.query) || 0) + 1)
    }
  })
  
  return Array.from(queryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query]) => query)
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

