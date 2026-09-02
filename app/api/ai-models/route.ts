import { NextResponse } from 'next/server'
import { getSupabaseAdmin, transformToAIEntry } from '@/lib/supabase'
import { fetchAIModelsFromSources } from '@/lib/data-sources'
import type { AIEntry } from '@/lib/ai-data'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { parseNaturalLanguageSearch, validateSearchResults, discoverNewTools } from '@/lib/gemini'
import { processSearchQuery, buildSearchConditions } from '@/lib/search-utils'
import { hybridSearch, isSemanticSearchAvailable, generateToolEmbedding } from '@/lib/embeddings'
import { searchExternalFallback } from '@/lib/search-fallback'
import { runSearchPipeline } from '@/lib/search-pipeline'

// Increase timeout for Vercel Pro (30s), or remove for Hobby plan (10s max)
export const maxDuration = 30
export const runtime = 'nodejs'

// Simple in-memory cache for Gemini results to avoid redundant calls
const geminiCache = new Map<string, { data: any, timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour
let lastGeminiErrorTime = 0
const ERRROR_COOLDOWN = 1000 * 60 // 1 minute cooldown after 429

/**
 * GET /api/ai-models
 * Fetches AI models from Supabase with optional filtering, pagination, and search
 * Falls back to external sources if Supabase fails
 */
export async function GET(request: Request) {
  console.log('HIT API ROUTE:', request.url)

  // Time budget: leave ~7s headroom under maxDuration for response serialization,
  // network flush, etc. Any stage that can't fit in the remaining budget is skipped
  // rather than risking a hard 504 with zero results returned.
  const requestStart = Date.now()
  const TIME_BUDGET_MS = (maxDuration * 1000) - 7000
  const timeRemaining = () => TIME_BUDGET_MS - (Date.now() - requestStart)
  // Rate limiting - more balanced limits
  const rateLimit = checkRateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute (1 per second on average)
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        message: 'Rate limit exceeded. Maximum 60 requests per minute.',
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
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') // Support fetching by specific ID
  const category = searchParams.get('category')
  const region = searchParams.get('region')
  const accessType = searchParams.get('accessType')
  const search = searchParams.get('search')

  // Validate and sanitize limit and offset
  const limitParam = searchParams.get('limit') || '500'
  const offsetParam = searchParams.get('offset') || '0'
  const limit = Math.max(1, Math.min(1000, parseInt(limitParam, 10) || 500))
  const offset = Math.max(0, parseInt(offsetParam, 10) || 0)

  // Log filters for debugging (only in development)
  if (process.env.NODE_ENV === 'development' && (category || region || accessType)) {
    logger.debug('API filters (raw):', { category, region, accessType, limit, offset })
    if (category) {
      logger.debug('API filters (decoded category):', decodeURIComponent(category).trim())
    }
  }

  try {
    const supabase = getSupabaseAdmin()
    const SUPABASE_MAX_LIMIT = 1000 // Supabase PostgREST default max per query

    // Get total count for debugging (only in development)
    if (process.env.NODE_ENV === 'development' && !category && !region && !accessType && !search) {
      const { count } = await supabase
        .from('ai_tools')
        .select('*', { count: 'exact', head: true })
      logger.debug(`[API] Total tools in database: ${count}`)
    }

    // Capture original search for NLP check
    const originalSearch = search
    let effectiveSearch = search
    let effectiveCategory = category
    let searchKeywords: string[] = []  // Processed keywords for enhanced search

    // Process search query with smart enhancements (typo correction, synonyms, etc.)
    if (search) {
      const processed = processSearchQuery(search)
      searchKeywords = processed.expanded // Use expanded keywords (includes synonyms)

      if (processed.typosCorrected) {
        logger.info(`[API] Typo corrected: "${search}" → "${processed.normalized}"`)
      }

      logger.debug('[API] Processed search:', {
        original: processed.original,
        keywords: processed.keywords,
        expanded: processed.expanded
      })
    }

    // Check if this looks like a natural language query - ignore very short queries to save quota
    const isNaturalLanguage = search && search.length > 15 && (
      /\b(want|need|looking for|help me|that can|for|i want|i need|can you|find me|show me)\b/i.test(search) ||
      search.split(/\s+/).length > 4
    )

    const now = Date.now()
    const canUseGemini = now - lastGeminiErrorTime > ERRROR_COOLDOWN

    if (isNaturalLanguage && search && canUseGemini) {
      const cleanQuery = search.toLowerCase().trim()
      try {
        // 1. Check in-memory fast cache first
        const cacheKey = `nlp:${cleanQuery}`
        const cached = geminiCache.get(cacheKey)
        let nlpParams = null

        if (cached && (now - cached.timestamp < CACHE_TTL)) {
          nlpParams = cached.data
          logger.debug('[API] NLP Search (Memory Cache):', nlpParams)
        } else {
          // 2. Check long-term Supabase database cache to heavily save Gemini tokens!
          try {
            const { data: dbCache } = await supabase
              .from('search_cache')
              .select('nlp_keywords, nlp_categories')
              .eq('query_text', cleanQuery)
              .single()

            if (dbCache && dbCache.nlp_keywords && dbCache.nlp_keywords.length > 0) {
              nlpParams = {
                keywords: dbCache.nlp_keywords,
                categories: dbCache.nlp_categories || []
              }
              logger.debug('[API] NLP Search (Database Cache):', nlpParams)
              geminiCache.set(cacheKey, { data: nlpParams, timestamp: now })
            }
          } catch (e) {
            // Table doesn't exist yet or cache miss
          }

          // 3. Fallback: Parse via Gemini API
          if (!nlpParams) {
            nlpParams = await parseNaturalLanguageSearch(search)
            if (nlpParams) {
              geminiCache.set(cacheKey, { data: nlpParams, timestamp: now })
              logger.debug('[API] NLP Search Parsed (Gemini):', nlpParams)
              // Update long-term database cache to avoid future API calls for this search
              try {
                // Ignore await so we don't block the request
                supabase.from('search_cache').upsert({
                  query_text: cleanQuery,
                  nlp_keywords: nlpParams.keywords,
                  nlp_categories: nlpParams.categories
                }, { onConflict: 'query_text' }).then()
              } catch (e) { }
            }
          }
        }

        // Apply NLP output to query logic
        if (nlpParams) {
          if (nlpParams.keywords.length > 0) effectiveSearch = nlpParams.keywords.join(' ')
          if (!category && nlpParams.categories.length > 0) effectiveCategory = nlpParams.categories[0]
        }
      } catch (err: any) {
        // Handle both quota errors (429) and AI unavailable (503)
        if (err.status === 429 || err.status === 503 || err.isAIUnavailable) {
          lastGeminiErrorTime = now
          logger.warn('[API] Gemini NLP unavailable. Falling back to keyword search for 1 minute.')
          // Use the raw search terms as keywords for fallback
          effectiveSearch = search
        } else {
          logger.error('[API] NLP Parsing error:', err)
        }
      }
    }

    // Log what search terms are being used (debug)
    if (originalSearch) {
      logger.info(`[API] Search: original="${originalSearch}" effective="${effectiveSearch}" category="${effectiveCategory || 'none'}"`)

      // Track popular searches for autocomplete suggestions (fire-and-forget)
      const cleanQuery = originalSearch.toLowerCase().trim()
      if (cleanQuery.length >= 3) {
        // Track popular searches for autocomplete (fire-and-forget async)
        ; (async () => {
          try {
            const { error } = await supabase.rpc('increment_search_count', { search_query: cleanQuery })
            if (error) {
              // Table might not exist — try upsert fallback
              await supabase.from('search_cache').upsert({
                query_text: cleanQuery,
                use_count: 1,
              }, { onConflict: 'query_text' })
            }
          } catch {
            // Ignore errors for background tracking
          }
        })()
      }
    }

    // Try semantic search first if available (best results)
    let semanticResults: (AIEntry & { _similarity?: number })[] = []
    let rawHybridResults: any[] = [] // Preserved for the ranking pipeline
    if (originalSearch && !category && !region && !accessType) {
      try {
        const isAvailable = await isSemanticSearchAvailable()
        if (isAvailable) {
          logger.info('[API] Using semantic/hybrid search')
          const results = await hybridSearch(originalSearch, limit, 0.20, searchKeywords)

          if (results.length > 0) {
            // Preserve raw normalized results for the ranking pipeline
            rawHybridResults = results

            // Also map to AIEntry shape for downstream consumers
            semanticResults = results.map(r => ({
              id: r.id,
              name: r.title,
              category: r.category,
              description: r.description || '',
              platform: r.platform,
              region: r.region || 'Global',
              accessType: (r.access_type || 'Freemium') as AIEntry['accessType'],
              pricing: r.pricing || '',
              tags: r.tags || [],
              popularity: r.popularity || 0,
              lastUpdated: r.last_updated || '',
              isTrending: r.is_trending || false,
              image: r.image || '',
              _similarity: r.similarity
            }))

            logger.info(`[API] Semantic search found ${semanticResults.length} results`)
          }
        }
      } catch (error) {
        logger.debug('[API] Semantic search not available:', error)
      }
    }

    // If fetching by specific ID, return early with just that tool
    if (id) {
      const { data, error } = await supabase
        .from('ai_tools')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        return NextResponse.json(
          { error: 'Tool not found' },
          { status: 404 }
        )
      }

      return NextResponse.json([transformToAIEntry(data)], {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      })
    }

    // Build base query for filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildBaseQuery = (queryBuilder: any) => {
      // Category filter - use case-insensitive matching
      if (effectiveCategory) {
        // URLSearchParams.get() automatically decodes + to spaces
        // But handle potential double-encoding
        let decodedCategory = effectiveCategory
        try {
          // If it contains % encoding, decode it
          if (effectiveCategory.includes('%')) {
            decodedCategory = decodeURIComponent(effectiveCategory).trim()
          } else {
            decodedCategory = effectiveCategory.trim()
          }
        } catch {
          decodedCategory = effectiveCategory.trim()
        }

        // Special handling for Marketing and Design - also search by tags
        const isMarketing = decodedCategory.includes('Marketing') || decodedCategory.toLowerCase().includes('marketing')
        const isDesign = decodedCategory.includes('Design') || decodedCategory.toLowerCase().includes('design')

        // Use ilike for case-insensitive matching
        // If category contains multiple values separated by comma, use OR logic
        if (decodedCategory.includes(',')) {
          const categories = decodedCategory.split(',').map(c => c.trim()).filter(Boolean)
          // Build combined OR query with categories and tags
          let orConditions = categories.map(cat => `category.ilike.${cat}`).join(',')

          // For Marketing and Design, add tag conditions to the OR query
          if (isMarketing) {
            orConditions += ',tags.cs.{marketing},tags.cs.{marketing-automation},tags.cs.{advertising},tags.cs.{seo}'
          }
          if (isDesign) {
            orConditions += ',tags.cs.{design},tags.cs.{ui},tags.cs.{ux},tags.cs.{graphic-design},tags.cs.{design-tools}'
          }

          queryBuilder = queryBuilder.or(orConditions)

          if (process.env.NODE_ENV === 'development') {
            logger.debug(`[API] Filtering by multiple categories (OR): "${categories.join(', ')}"`)
          }
        } else {
          // For single category, combine with tag search if needed
          if (isMarketing) {
            queryBuilder = queryBuilder.or(`category.ilike.${decodedCategory},tags.cs.{marketing},tags.cs.{marketing-automation},tags.cs.{advertising},tags.cs.{seo}`)
          } else if (isDesign) {
            queryBuilder = queryBuilder.or(`category.ilike.${decodedCategory},tags.cs.{design},tags.cs.{ui},tags.cs.{ux},tags.cs.{graphic-design},tags.cs.{design-tools}`)
          } else {
            queryBuilder = queryBuilder.ilike('category', decodedCategory)
          }
        }
      }
      if (region) {
        let decodedRegion = region
        try {
          if (region.includes('%')) {
            decodedRegion = decodeURIComponent(region).trim()
          } else {
            decodedRegion = region.trim()
          }
        } catch {
          decodedRegion = region.trim()
        }
        queryBuilder = queryBuilder.ilike('region', `%${decodedRegion}%`)
      }
      if (accessType) {
        let decodedAccessType = accessType
        try {
          if (accessType.includes('%')) {
            decodedAccessType = decodeURIComponent(accessType).trim()
          } else {
            decodedAccessType = accessType.trim()
          }
        } catch {
          decodedAccessType = accessType.trim()
        }
        queryBuilder = queryBuilder.ilike('access_type', decodedAccessType)
      }

      // Use enhanced search with processed keywords (includes synonyms and typo corrections)
      if (searchKeywords.length > 0) {
        // Build search conditions using expanded keywords
        const conditions = buildSearchConditions(searchKeywords)
        queryBuilder = queryBuilder.or(conditions)

        // Also add the full original search phrase for exact matches
        if (effectiveSearch) {
          const escapedSearch = effectiveSearch.replace(/%/g, '\\%').replace(/_/g, '\\_')
          queryBuilder = queryBuilder.or(`name.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%`)
        }
      } else if (effectiveSearch) {
        // Fallback: no processed keywords, use raw search
        const escapedSearch = effectiveSearch.replace(/%/g, '\\%').replace(/_/g, '\\_')
        const searchWords = escapedSearch.trim().split(/\s+/).filter(w => w.length > 2)

        if (searchWords.length > 0) {
          const conditions: string[] = []
          for (const word of searchWords) {
            conditions.push(`name.ilike.%${word}%`)
            conditions.push(`description.ilike.%${word}%`)
            conditions.push(`platform.ilike.%${word}%`)
            conditions.push(`tags.cs.{${word.toLowerCase()}}`)
          }
          queryBuilder = queryBuilder.or(conditions.join(','))
        } else {
          queryBuilder = queryBuilder.or(`name.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%,platform.ilike.%${escapedSearch}%`)
        }
      }
      return queryBuilder
    }

    let allData: Array<{
      id: string
      name: string
      category: string
      description?: string | null
      platform: string
      region: string
      access_type: string
      pricing?: string | null
      tags?: string[] | null
      popularity?: number | null
      last_updated?: string | null
      is_trending?: boolean | null
      image?: string | null
    }> = []

    const hasFilters = effectiveCategory || region || accessType || effectiveSearch

    // If semantic search found good results, run them through the ranking pipeline
    if (semanticResults.length >= 1) {
      // Find the best match score
      const maxScore = Math.max(...semanticResults.map((r: AIEntry & { _similarity?: number }) => r._similarity || 0))

      // If our DB actually contains a very strong semantic match (e.g. > 0.65 similarity)
      // then run through the ranking pipeline for proper ordering
      if (maxScore > 0.65) {
        // Filter out the "loose" trailing matches (cosine similarity < 0.55) so we only return relevant stuff
        const filteredSemantic = semanticResults.filter((r: AIEntry & { _similarity?: number }) => (r._similarity || 0) > 0.55)
        const filteredRaw = rawHybridResults.filter((r: any) => (r.similarity || 0) > 0.55)

        if (filteredSemantic.length > 0) {
          logger.info(`[API] Running ${filteredRaw.length} strong semantic results through ranking pipeline (max similarity: ${maxScore.toFixed(3)})`)

          try {
            // Run through the Gemini-powered ranking pipeline
            const ranked = await runSearchPipeline(originalSearch!, filteredRaw)

            // Re-order filteredSemantic according to the ranked result order
            if (ranked.results && ranked.results.length > 0) {
              const rankedOrder = new Map(ranked.results.map((r, i) => [r.id || r.title, i]))
              const reordered = [...filteredSemantic].sort((a, b) => {
                const aIdx = rankedOrder.get(a.id) ?? rankedOrder.get(a.name) ?? 999
                const bIdx = rankedOrder.get(b.id) ?? rankedOrder.get(b.name) ?? 999
                return aIdx - bIdx
              })

              logger.info(`[API] Returning ${reordered.length} ranked semantic results (intent: ${ranked.query_intent}, confidence: ${ranked.confidence_level})`)

              return NextResponse.json(reordered, {
                headers: {
                  ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
                  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                  'X-Search-Type': 'semantic+ranked',
                  'X-Search-Pipeline': ranked.confidence_level,
                  'X-Search-Intent': ranked.query_intent,
                  ...(originalSearch ? { 'X-Search-Query': originalSearch } : {}),
                },
              })
            }

            // If ranking returned no results, fall through to unranked
            return NextResponse.json(filteredSemantic, {
              headers: {
                ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                'X-Search-Type': 'semantic',
                ...(originalSearch ? { 'X-Search-Query': originalSearch } : {}),
              },
            })
          } catch (pipelineError) {
            logger.error('[API] Search pipeline failed, returning unranked results:', pipelineError)
            // Fallback: return unranked semantic results
            return NextResponse.json(filteredSemantic, {
              headers: {
                ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                'X-Search-Type': 'semantic',
                ...(originalSearch ? { 'X-Search-Query': originalSearch } : {}),
              },
            })
          }
        }
      } else {
        logger.info(`[API] Semantic results were too weak (max similarity: ${maxScore.toFixed(3)}). Falling back to traditional + external search...`)
        // Clear semantic results so it doesn't mess up our fallback flow
        semanticResults = [] as (AIEntry & { _similarity?: number })[]
      }
    }

    // Fast path: single query for small requests
    if (limit <= SUPABASE_MAX_LIMIT) {
      let query = supabase
        .from('ai_tools')
        .select('*')
        .order('priority', { ascending: false, nullsFirst: false })
        .order('popularity', { ascending: false })

      query = buildBaseQuery(query)
      query = query.range(offset, offset + limit - 1)

      const { data, error } = await query

      if (error) {
        logger.error('Supabase query error:', error)
        throw error
      }

      if (data) {
        allData = data
      }
    } else if (hasFilters) {
      let currentOffset = 0
      const MAX_FETCH = Math.min(limit, 50000)
      let hasMore = true

      while (hasMore && allData.length < MAX_FETCH) {
        let query = supabase
          .from('ai_tools')
          .select('*')
          .order('priority', { ascending: false, nullsFirst: false })
          .order('popularity', { ascending: false })

        query = buildBaseQuery(query)
        const batchEnd = currentOffset + SUPABASE_MAX_LIMIT - 1
        query = query.range(currentOffset, batchEnd)

        const { data: batchData, error: batchError } = await query

        if (batchError) {
          logger.error('Supabase batch error:', batchError)
          break
        }

        if (batchData && batchData.length > 0) {
          allData.push(...batchData)
          currentOffset += SUPABASE_MAX_LIMIT
          if (batchData.length < SUPABASE_MAX_LIMIT) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }

      if (offset > 0 || allData.length > limit) {
        allData = allData.slice(offset, offset + limit)
      }
    } else {
      const batches = Math.ceil(limit / SUPABASE_MAX_LIMIT)

      const fetchBatchWithRetry = async (batchIndex: number, retries = 2): Promise<any[]> => {
        const batchOffset = offset + (batchIndex * SUPABASE_MAX_LIMIT)
        const batchLimit = Math.min(SUPABASE_MAX_LIMIT, limit - (batchIndex * SUPABASE_MAX_LIMIT))

        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            let batchQuery = supabase
              .from('ai_tools')
              .select('*')
              .order('priority', { ascending: false, nullsFirst: false })
              .order('popularity', { ascending: false })

            batchQuery = buildBaseQuery(batchQuery)
            batchQuery = batchQuery.range(batchOffset, batchOffset + batchLimit - 1)

            const { data, error } = await batchQuery

            if (error) {
              throw error
            }

            return data || []
          } catch (error) {
            if (attempt === retries) {
              return []
            }
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)))
          }
        }
        return []
      }

      const batchPromises = []
      for (let i = 0; i < batches; i++) {
        batchPromises.push(fetchBatchWithRetry(i))
      }

      const batchResults = await Promise.allSettled(batchPromises)

      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i]
        if (result.status === 'fulfilled') {
          const data = result.value
          if (data && data.length > 0) {
            allData.push(...data)
          }
        }
      }

      allData.sort((a, b) => {
        const priorityDiff = ((b as any).priority || 0) - ((a as any).priority || 0)
        if (priorityDiff !== 0) return priorityDiff
        return (b.popularity || 0) - (a.popularity || 0)
      })
    }

    // Transform database rows to AIEntry format
    let aiEntries: AIEntry[] = allData.map(transformToAIEntry)

    // For search queries, filter and sort by relevance
    const searchToRank = effectiveSearch || search
    if (searchToRank && searchToRank.trim()) {
      const searchLower = searchToRank.toLowerCase().trim()
      const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0)

      if (searchWords.length > 1) {
        aiEntries = aiEntries.filter(entry => {
          const searchableText = `${entry.name} ${entry.description} ${entry.platform} ${entry.tags.join(' ')}`.toLowerCase()
          return searchWords.every(word => searchableText.includes(word))
        })
      } else {
        aiEntries = aiEntries.filter(entry => {
          const searchableText = `${entry.name} ${entry.description} ${entry.platform} ${entry.tags.join(' ')}`.toLowerCase()
          return searchableText.includes(searchLower)
        })
      }

      aiEntries = aiEntries.map(entry => {
        let relevanceScore = 0
        const entryName = entry.name.toLowerCase()
        const entryDesc = entry.description.toLowerCase()
        const entryPlatform = entry.platform.toLowerCase()
        const entryTags = (entry.tags || []).join(' ').toLowerCase()

        if (entryName === searchLower) {
          relevanceScore += 1000
        } else if (entryName.startsWith(searchLower)) {
          relevanceScore += 800
        } else if (entryName.includes(searchLower)) {
          relevanceScore += 600
        }

        if (searchWords.length > 1) {
          const allWordsInName = searchWords.every(word => entryName.includes(word))
          if (allWordsInName) {
            relevanceScore += 700
          }
        }

        if (entryDesc.includes(searchLower)) {
          relevanceScore += 300
        }

        if (entryPlatform.includes(searchLower)) {
          relevanceScore += 200
        }

        const matchingTags = (entry.tags || []).filter(tag => {
          const tagLower = tag.toLowerCase()
          return tagLower === searchLower || tagLower.includes(searchLower) || searchLower.includes(tagLower)
        })
        relevanceScore += matchingTags.length * 250

        if (searchWords.length > 1) {
          const tagsWithAllWords = (entry.tags || []).filter(tag => {
            const tagLower = tag.toLowerCase()
            return searchWords.every(word => tagLower.includes(word))
          })
          relevanceScore += tagsWithAllWords.length * 300
        }

        relevanceScore += (entry.popularity || 0) * 0.5

        if (entry.isTrending) {
          relevanceScore += 150
        }

        const nameIndex = entryName.indexOf(searchLower)
        if (nameIndex >= 0 && nameIndex < 10) {
          relevanceScore += 100
        }

        return { ...entry, _relevanceScore: relevanceScore }
      }).sort((a, b) => {
        const aScore = (a as AIEntry & { _relevanceScore: number })._relevanceScore
        const bScore = (b as AIEntry & { _relevanceScore: number })._relevanceScore
        const scoreDiff = bScore - aScore
        if (scoreDiff !== 0) return scoreDiff
        return (b.popularity || 0) - (a.popularity || 0)
      }).map((entry) => {
        const { _relevanceScore, ...rest } = entry as AIEntry & { _relevanceScore: number }
        return rest
      })
    }

    // AI Validation and Discovery
    // Tightened gate vs. the previous version:
    //  - require isNaturalLanguage (not just "zero results") — a query with zero results because
    //    it's off-topic junk (e.g. "help with my assignment") should NOT trigger discovery writes
    //  - require a minimum time budget so this never fires when we're already close to the deadline
    // NOTE: also consider requiring a minimum extracted-keyword count / category confidence here
    // once nlpParams carries a confidence score — that would filter out vague queries even further.
    // Matches gemini.ts worst case: PRIMARY_TIMEOUT_MS (7s) + FALLBACK_TIMEOUT_MS (6s) + buffer
    const MIN_BUDGET_FOR_VALIDATION_MS = 15000
    if (
      originalSearch &&
      canUseGemini &&
      isNaturalLanguage &&
      aiEntries.length < 5 &&
      timeRemaining() > MIN_BUDGET_FOR_VALIDATION_MS
    ) {
      const cacheKeyValid = `valid:${originalSearch.toLowerCase()}:${aiEntries.length}`
      const cachedValid = geminiCache.get(cacheKeyValid)

      let validationResult = cachedValid?.data
      if (!validationResult) {
        validationResult = await validateSearchResults(originalSearch, aiEntries)
        geminiCache.set(cacheKeyValid, { data: validationResult, timestamp: now })
      }

      const { isRelevant, feedback } = validationResult
      logger.debug('[API] Search Relevance:', { isRelevant, feedback })

      if (!isRelevant || aiEntries.length === 0) {
        const cacheKeyDisc = `disc:${originalSearch.toLowerCase()}`
        const cachedDisc = geminiCache.get(cacheKeyDisc)

        if (cachedDisc && (now - cachedDisc.timestamp < CACHE_TTL)) {
          logger.info('[API] Using cached discovery results')
          const dbTools = cachedDisc.data
          const newEntries = dbTools.map(transformToAIEntry)
          aiEntries = [...newEntries, ...aiEntries].slice(0, limit)
        } else if (timeRemaining() < 16000) {
          // Not enough budget left to safely run discovery (Gemini call + per-tool embedding
          // generation + DB upsert can easily take 5-10s+). Queue it instead of blocking the
          // response — a background worker/cron can pick this up and populate the corpus for
          // future searches without making *this* user wait or risk a 504.
          logger.info('[API] Skipping inline discovery (low time budget), queueing for background:', originalSearch)
          try {
            await supabase.from('discovery_queue').insert({
              query_text: originalSearch,
              status: 'pending',
              created_at: new Date().toISOString(),
            })
          } catch (e) {
            // Table may not exist yet — this queue is a TODO, see note below
            logger.debug('[API] discovery_queue insert failed (table may not exist yet):', e)
          }
        } else {
          logger.info('[API] Triggering AI Discovery for:', originalSearch)
          try {
            const newTools = await discoverNewTools(originalSearch)
            if (newTools.length > 0) {
              const dbTools = newTools.map(tool => ({
                id: `ai-discovery-${tool.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                name: tool.name,
                category: tool.category,
                description: tool.description,
                platform: tool.platform,
                region: tool.region,
                access_type: tool.accessType,
                pricing: tool.pricing,
                tags: tool.tags,
                popularity: 70,
                last_updated: new Date().toISOString().split('T')[0],
                priority: 5
              }))

              const toolsWithEmbeddings = await Promise.all(
                dbTools.map(async (tool) => {
                  try {
                    const embedding = await generateToolEmbedding(
                      tool.name,
                      tool.description || '',
                      tool.category,
                      tool.tags || []
                    )
                    return { ...tool, embedding }
                  } catch (e) {
                    logger.warn(`[API] Could not generate embedding for discovery tool: ${tool.name}`, e)
                    return tool
                  }
                })
              )

              geminiCache.set(cacheKeyDisc, { data: dbTools, timestamp: now })

              const { error: insertError } = await supabase
                .from('ai_tools')
                .upsert(toolsWithEmbeddings, { onConflict: 'id' })

              if (insertError) {
                logger.error('[API] Discovery Ingestion Error:', insertError)
              } else {
                logger.info(`[API] ✅ Successfully saved ${dbTools.length} NEW tools to database:`)
                const newEntries = dbTools.map(transformToAIEntry)
                aiEntries = [...newEntries, ...aiEntries].slice(0, limit)
              }
            }
          } catch (err: any) {
            if (err.status === 429 || err.status === 503 || err.isAIUnavailable) {
              lastGeminiErrorTime = now
              logger.warn('[API] Gemini unavailable during discovery. Using cached/external sources.')
            } else {
              logger.error('[API] Discovery error:', err)
            }
          }
        }
      }
    }

    // Real-time external fallback — if search returned few/no results, search GitHub + HuggingFace live
    // Guarded by remaining time budget: this chain makes multiple external API calls and should
    // never be the thing that pushes us over maxDuration.
    if (originalSearch && aiEntries.length < 3 && timeRemaining() > 9000) {
      logger.info(`[API] Only ${aiEntries.length} results for "${originalSearch}". Trying real-time external search...`)
      try {
        const fallback = await searchExternalFallback(originalSearch, aiEntries, limit)
        if (fallback.results.length > aiEntries.length) {
          logger.info(`[API] External fallback found ${fallback.results.length - aiEntries.length} additional results (source: ${fallback.source})`)
          aiEntries = fallback.results
        }
      } catch (fallbackError) {
        logger.error('[API] External fallback error:', fallbackError)
      }
    }

    return NextResponse.json(aiEntries, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
        ...(originalSearch ? { 'X-Search-Query': originalSearch } : {}),
      },
    })
  } catch (error) {
    logger.error('Error in /api/ai-models:', error)

    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'object' ? JSON.stringify(error) : 'An unexpected error occurred while fetching AI tools.'

    return NextResponse.json(
      {
        error: 'Unable to load AI tools at this time',
        message: 'We encountered an issue while fetching the data. Please try again in a moment.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        data: []
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60',
          ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
        }
      }
    )
  }
}
