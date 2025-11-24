import { NextResponse } from 'next/server'
import { getSupabaseAdmin, transformToAIEntry } from '@/lib/supabase'
import { fetchAIModelsFromSources } from '@/lib/data-sources'
import type { AIEntry } from '@/lib/ai-data'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// Increase timeout for Vercel Pro (30s), or remove for Hobby plan (10s max)
export const maxDuration = 30
export const runtime = 'nodejs'

/**
 * GET /api/ai-models
 * Fetches AI models from Supabase with optional filtering, pagination, and search
 * Falls back to external sources if Supabase fails
 */
export async function GET(request: Request) {
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
      if (category) {
        // URLSearchParams.get() automatically decodes + to spaces
        // But handle potential double-encoding
        let decodedCategory = category
        try {
          // If it contains % encoding, decode it
          if (category.includes('%')) {
            decodedCategory = decodeURIComponent(category).trim()
          } else {
            decodedCategory = category.trim()
          }
        } catch {
          decodedCategory = category.trim()
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
            if (isMarketing || isDesign) {
              logger.debug(`[API] Also searching tags for ${isMarketing ? 'Marketing' : ''} ${isDesign ? 'Design' : ''}`)
            }
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
          
          // Debug logging in development
          if (process.env.NODE_ENV === 'development') {
            logger.debug(`[API] Filtering by category: "${decodedCategory}" (raw: "${category}")`)
            if (isMarketing || isDesign) {
              logger.debug(`[API] Also searching tags for ${isMarketing ? 'Marketing' : ''} ${isDesign ? 'Design' : ''}`)
            }
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
        queryBuilder = queryBuilder.ilike('region', decodedRegion)
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
      if (search) {
        // Use proper Supabase syntax for search across name, description, and platform
        // Tags will be searched client-side since Supabase array search is complex
        // Escape special characters in search term
        const escapedSearch = search.replace(/%/g, '\\%').replace(/_/g, '\\_')
        
        // For multi-word queries, search for each word individually
        // We'll filter client-side to ensure all words match
        const searchWords = escapedSearch.trim().split(/\s+/).filter(w => w.length > 0)
        
        if (searchWords.length > 1) {
          // Multi-word query: search for each word in name, description, or platform
          // Use OR to match if any word appears in any field
          // Client-side filtering will ensure all words match
          const conditions: string[] = []
          for (const word of searchWords) {
            conditions.push(`name.ilike.%${word}%`)
            conditions.push(`description.ilike.%${word}%`)
            conditions.push(`platform.ilike.%${word}%`)
          }
          // Also search for the full phrase
          conditions.push(`name.ilike.%${escapedSearch}%`)
          conditions.push(`description.ilike.%${escapedSearch}%`)
          conditions.push(`platform.ilike.%${escapedSearch}%`)
          
          queryBuilder = queryBuilder.or(conditions.join(','))
        } else {
          // Single word query: search in name, description, and platform
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
    
    // Check if filters are applied
    const hasFilters = category || region || accessType || search
    
    // Fast path: single query for small requests
    if (limit <= SUPABASE_MAX_LIMIT) {
      let query = supabase
        .from('ai_tools')
        .select('*')
        .order('popularity', { ascending: false })
      
      query = buildBaseQuery(query)
      
      // Apply range after filters for correct pagination
      query = query.range(offset, offset + limit - 1)
      
      const { data, error } = await query
      
      if (error) {
        logger.error('Supabase query error:', error)
        throw error
      }
      
      if (data) {
        allData = data
        
        // Debug: Log results count in development
        if (process.env.NODE_ENV === 'development' && category) {
          logger.debug(`[API] Fast path: Query returned ${data.length} results for category: "${category}"`)
          if (data.length > 0) {
            logger.debug(`[API] Sample category from results: "${data[0].category}"`)
          } else {
            // Check what categories actually exist in the database
            const { data: sampleCategories } = await supabase
              .from('ai_tools')
              .select('category')
              .limit(100)
            const uniqueCategories = [...new Set(sampleCategories?.map(t => t.category) || [])]
            logger.debug(`[API] Sample categories in DB:`, uniqueCategories.slice(0, 10))
            
            // Check specifically for AI Detection Tool variations - try exact match
            const { data: exactMatch } = await supabase
              .from('ai_tools')
              .select('category, name')
              .eq('category', category.trim())
              .limit(5)
            logger.debug(`[API] Exact match (eq) for "${category.trim()}":`, exactMatch?.length || 0, 'results')
            
            // Try case-insensitive with ilike pattern
            const { data: ilikeMatch } = await supabase
              .from('ai_tools')
              .select('category, name')
              .ilike('category', `%${category.trim()}%`)
              .limit(5)
            logger.debug(`[API] Case-insensitive match (ilike) for "${category.trim()}":`, ilikeMatch?.length || 0, 'results')
            if (ilikeMatch && ilikeMatch.length > 0) {
              logger.debug(`[API] Found categories:`, ilikeMatch.map(t => t.category))
            }
            
            // Check for any AI Detection related tools
            const { data: detectionTools } = await supabase
              .from('ai_tools')
              .select('category, name')
              .ilike('category', '%Detection%')
              .limit(10)
            logger.debug(`[API] Any Detection-related tools:`, detectionTools?.map(t => ({ name: t.name, category: t.category })))
          }
        }
      }
    } else if (hasFilters) {
      // When filters are applied, we need to fetch all matching results
      // because we don't know how many match until we query
      // Fetch sequentially in batches until we have enough or run out
      let currentOffset = 0
      const MAX_FETCH = Math.min(limit, 50000) // Safety limit
      let hasMore = true
      
      while (hasMore && allData.length < MAX_FETCH) {
        let query = supabase
          .from('ai_tools')
          .select('*')
          .order('popularity', { ascending: false })
        
        query = buildBaseQuery(query)
        
        // Fetch next batch
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
          
          // Debug logging for filtered queries
          if (process.env.NODE_ENV === 'development' && category && currentOffset === SUPABASE_MAX_LIMIT) {
            logger.debug(`[API] Filtered batch: Got ${batchData.length} results for category: "${category}"`)
            if (batchData.length > 0) {
              logger.debug(`[API] Sample category from batch: "${batchData[0].category}"`)
            }
          }
          
          // If we got less than the max, we've reached the end
          if (batchData.length < SUPABASE_MAX_LIMIT) {
            hasMore = false
          }
        } else {
          hasMore = false
          
          // Debug: If no results and we have a category filter, check what exists
          if (process.env.NODE_ENV === 'development' && category && allData.length === 0) {
            const { data: sampleCategories } = await supabase
              .from('ai_tools')
              .select('category')
              .limit(100)
            const uniqueCategories = [...new Set(sampleCategories?.map(t => t.category) || [])]
            logger.debug(`[API] No results for category "${category}". Sample categories in DB:`, uniqueCategories.slice(0, 10))
          }
        }
      }
      
      // Apply offset and limit client-side (since we fetched from offset 0)
      if (offset > 0 || allData.length > limit) {
        allData = allData.slice(offset, offset + limit)
      }
    } else {
      // Batch fetching for large requests WITHOUT filters - use parallel fetching with retries
      const batches = Math.ceil(limit / SUPABASE_MAX_LIMIT)
      
      // Log batch info for debugging
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`[API] Fetching ${batches} batches in parallel for limit=${limit}, offset=${offset}, hasFilters=${hasFilters}`)
      }
      
      // Helper function to fetch a batch with retry logic
      const fetchBatchWithRetry = async (batchIndex: number, retries = 2): Promise<any[]> => {
        const batchOffset = offset + (batchIndex * SUPABASE_MAX_LIMIT)
        const batchLimit = Math.min(SUPABASE_MAX_LIMIT, limit - (batchIndex * SUPABASE_MAX_LIMIT))
        
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            let batchQuery = supabase
              .from('ai_tools')
              .select('*')
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
              if (process.env.NODE_ENV === 'development') {
                const errorMessage = error instanceof Error ? error.message : String(error)
                logger.error(`[API] Batch ${batchIndex} failed after ${retries + 1} attempts:`, errorMessage)
              }
              return [] // Return empty array on final failure
            }
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)))
          }
        }
        return []
      }
      
      // Fetch batches in parallel (but with retry logic)
      const batchPromises = []
      for (let i = 0; i < batches; i++) {
        batchPromises.push(fetchBatchWithRetry(i))
      }
      
      // Execute all batches in parallel
      const batchResults = await Promise.allSettled(batchPromises)
      
      // Track results for debugging
      let successfulBatches = 0
      let totalItems = 0
      let failedBatches = 0
      
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i]
        if (result.status === 'fulfilled') {
          const data = result.value // Already processed in fetchBatchWithRetry
          if (data && data.length > 0) {
            allData.push(...data)
            totalItems += data.length
            successfulBatches++
            
            if (process.env.NODE_ENV === 'development') {
              logger.debug(`[API] Batch ${i}: Got ${data.length} items (range: ${offset + (i * SUPABASE_MAX_LIMIT)}-${offset + (i * SUPABASE_MAX_LIMIT) + data.length - 1})`)
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              logger.debug(`[API] Batch ${i}: No data returned`)
            }
            failedBatches++
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            logger.error(`[API] Batch ${i} promise rejected:`, result.reason)
          }
          failedBatches++
        }
      }
      
      // Log summary
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`[API] Batch fetch complete: ${successfulBatches}/${batches} successful, ${failedBatches} failed, total items: ${totalItems}, requested: ${limit}`)
      }
      
      // If we got significantly fewer results than expected, log a warning
      if (totalItems < limit * 0.5 && successfulBatches < batches) {
        logger.warn(`[API] ⚠️ Only fetched ${totalItems} items out of ${limit} requested. ${failedBatches} batches failed.`)
      }
      
      // Sort by popularity after parallel fetch (maintain order)
      allData.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    }
    
    if (allData.length === 0) {
      // Fallback to external sources only if Supabase is completely empty
      logger.debug('Supabase returned no data, trying external sources...')
      try {
        const externalModels = await fetchAIModelsFromSources()
        return NextResponse.json(externalModels.slice(0, limit), {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        })
      } catch (externalError) {
        // Return empty array instead of failing
        return NextResponse.json([], {
          headers: {
            'Cache-Control': 'public, s-maxage=60',
          },
        })
      }
    }
    
    // Transform database rows to AIEntry format
    let aiEntries: AIEntry[] = allData.map(transformToAIEntry)
    
    // For search queries, filter and sort by relevance
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim()
      const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0)
      
      // Filter: ensure all words match (for multi-word queries) and check tags
      if (searchWords.length > 1) {
        // Multi-word: all words must be present
        aiEntries = aiEntries.filter(entry => {
          const searchableText = `${entry.name} ${entry.description} ${entry.platform} ${entry.tags.join(' ')}`.toLowerCase()
          return searchWords.every(word => searchableText.includes(word))
        })
      } else {
        // Single-word: check all fields including tags
        aiEntries = aiEntries.filter(entry => {
          const searchableText = `${entry.name} ${entry.description} ${entry.platform} ${entry.tags.join(' ')}`.toLowerCase()
          return searchableText.includes(searchLower)
        })
      }
      
      // PRIORITY: Sort by relevance score
      aiEntries = aiEntries.map(entry => {
        let relevanceScore = 0
        const entryName = entry.name.toLowerCase()
        const entryDesc = entry.description.toLowerCase()
        const entryPlatform = entry.platform.toLowerCase()
        const entryTags = entry.tags.join(' ').toLowerCase()
        const searchableText = `${entryName} ${entryDesc} ${entryPlatform} ${entryTags}`
        
        // Exact name match (highest priority)
        if (entryName === searchLower) {
          relevanceScore += 1000
        } else if (entryName.startsWith(searchLower)) {
          relevanceScore += 800
        } else if (entryName.includes(searchLower)) {
          relevanceScore += 600
        }
        
        // For multi-word queries, check if all words appear in name
        if (searchWords.length > 1) {
          const allWordsInName = searchWords.every(word => entryName.includes(word))
          if (allWordsInName) {
            relevanceScore += 700
          }
        }
        
        // Description match
        if (entryDesc.includes(searchLower)) {
          relevanceScore += 300
        }
        
        // Platform match
        if (entryPlatform.includes(searchLower)) {
          relevanceScore += 200
        }
        
        // Tag matches (higher weight for exact tag matches)
        const matchingTags = entry.tags.filter(tag => {
          const tagLower = tag.toLowerCase()
          return tagLower === searchLower || tagLower.includes(searchLower) || searchLower.includes(tagLower)
        })
        relevanceScore += matchingTags.length * 250
        
        // For multi-word queries, check tag matches
        if (searchWords.length > 1) {
          const tagsWithAllWords = entry.tags.filter(tag => {
            const tagLower = tag.toLowerCase()
            return searchWords.every(word => tagLower.includes(word))
          })
          relevanceScore += tagsWithAllWords.length * 300
        }
        
        // Popularity boost (scaled)
        relevanceScore += entry.popularity * 0.5
        
        // Trending boost
        if (entry.isTrending) {
          relevanceScore += 150
        }
        
        // Position bonus: earlier in searchable text = more relevant
        const nameIndex = entryName.indexOf(searchLower)
        if (nameIndex >= 0 && nameIndex < 10) {
          relevanceScore += 100
        }
        
        return { ...entry, _relevanceScore: relevanceScore }
      }).sort((a, b) => {
        // Sort by relevance score (descending), then by popularity
        const aScore = (a as AIEntry & { _relevanceScore: number })._relevanceScore
        const bScore = (b as AIEntry & { _relevanceScore: number })._relevanceScore
        const scoreDiff = bScore - aScore
        if (scoreDiff !== 0) return scoreDiff
        return b.popularity - a.popularity
      }).map((entry) => {
        // Remove temporary score field
        const { _relevanceScore, ...rest } = entry as AIEntry & { _relevanceScore: number }
        return rest
      })
    }
    
    // Log response size for debugging
    if (process.env.NODE_ENV === 'development') {
      const responseSize = JSON.stringify(aiEntries).length
      const responseSizeMB = (responseSize / 1024 / 1024).toFixed(2)
      logger.debug(`[API] Returning ${aiEntries.length} tools, response size: ${responseSizeMB} MB (requested: ${limit})`)
      
      // Check if response might be too large (Vercel has ~4.5MB limit)
      if (responseSize > 4 * 1024 * 1024) {
        logger.warn(`[API] ⚠️ Response size (${responseSizeMB} MB) is approaching Vercel's 4.5MB limit!`)
      }
    }
    
    // REMOVED: External source merging - too slow and causes timeouts
    // External sources should be synced via a separate cron job
    
    return NextResponse.json(aiEntries, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
      },
    })
  } catch (error) {
    logger.error('Error in /api/ai-models:', error)
    
    // User-friendly error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred while fetching AI tools.'
    
    // Return user-friendly error with empty data - better UX
    return NextResponse.json(
      { 
        error: 'Unable to load AI tools at this time',
        message: 'We encountered an issue while fetching the data. Please try again in a moment.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        data: [] 
      },
      { 
        status: 200, // Return 200 with empty data instead of 500 for better UX
      headers: {
          'Cache-Control': 'public, s-maxage=60',
          ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
        } 
      }
    )
  }
}

