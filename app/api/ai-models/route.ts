import { NextResponse } from 'next/server'
import { getSupabaseAdmin, transformToAIEntry } from '@/lib/supabase'
import { fetchAIModelsFromSources } from '@/lib/data-sources'
import type { AIEntry } from '@/lib/ai-data'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'

// Increase timeout for Vercel Pro (30s), or remove for Hobby plan (10s max)
export const maxDuration = 30
export const runtime = 'nodejs'

/**
 * GET /api/ai-models
 * Fetches AI models from Supabase with optional filtering, pagination, and search
 * Falls back to external sources if Supabase fails
 */
export async function GET(request: Request) {
  // Rate limiting
  const rateLimit = checkRateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute (more lenient for API)
  })
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        message: 'Rate limit exceeded. Maximum 100 requests per minute.',
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
    console.log('API filters (raw):', { category, region, accessType, limit, offset })
    if (category) {
      console.log('API filters (decoded category):', decodeURIComponent(category).trim())
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
      console.log(`[API] Total tools in database: ${count}`)
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
        
        // Use ilike for case-insensitive matching
        queryBuilder = queryBuilder.ilike('category', decodedCategory)
        
        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API] Filtering by category: "${decodedCategory}" (raw: "${category}")`)
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
        try {
          const decodedSearch = decodeURIComponent(search)
          queryBuilder = queryBuilder.or(`name.ilike.%${decodedSearch}%,description.ilike.%${decodedSearch}%`)
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Invalid search encoding:', search, e)
          }
          queryBuilder = queryBuilder.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
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
        console.error('Supabase query error:', error)
        throw error
      }
      
      if (data) {
        allData = data
        
        // Debug: Log results count in development
        if (process.env.NODE_ENV === 'development' && category) {
          console.log(`[API] Fast path: Query returned ${data.length} results for category: "${category}"`)
          if (data.length > 0) {
            console.log(`[API] Sample category from results: "${data[0].category}"`)
          } else {
            // Check what categories actually exist in the database
            const { data: sampleCategories } = await supabase
              .from('ai_tools')
              .select('category')
              .limit(100)
            const uniqueCategories = [...new Set(sampleCategories?.map(t => t.category) || [])]
            console.log(`[API] Sample categories in DB:`, uniqueCategories.slice(0, 10))
            
            // Check specifically for AI Detection Tool variations - try exact match
            const { data: exactMatch } = await supabase
              .from('ai_tools')
              .select('category, name')
              .eq('category', category.trim())
              .limit(5)
            console.log(`[API] Exact match (eq) for "${category.trim()}":`, exactMatch?.length || 0, 'results')
            
            // Try case-insensitive with ilike pattern
            const { data: ilikeMatch } = await supabase
              .from('ai_tools')
              .select('category, name')
              .ilike('category', `%${category.trim()}%`)
              .limit(5)
            console.log(`[API] Case-insensitive match (ilike) for "${category.trim()}":`, ilikeMatch?.length || 0, 'results')
            if (ilikeMatch && ilikeMatch.length > 0) {
              console.log(`[API] Found categories:`, ilikeMatch.map(t => t.category))
            }
            
            // Check for any AI Detection related tools
            const { data: detectionTools } = await supabase
              .from('ai_tools')
              .select('category, name')
              .ilike('category', '%Detection%')
              .limit(10)
            console.log(`[API] Any Detection-related tools:`, detectionTools?.map(t => ({ name: t.name, category: t.category })))
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
          console.error('Supabase batch error:', batchError)
          break
        }
        
        if (batchData && batchData.length > 0) {
          allData.push(...batchData)
          currentOffset += SUPABASE_MAX_LIMIT
          
          // Debug logging for filtered queries
          if (process.env.NODE_ENV === 'development' && category && currentOffset === SUPABASE_MAX_LIMIT) {
            console.log(`[API] Filtered batch: Got ${batchData.length} results for category: "${category}"`)
            if (batchData.length > 0) {
              console.log(`[API] Sample category from batch: "${batchData[0].category}"`)
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
            console.log(`[API] No results for category "${category}". Sample categories in DB:`, uniqueCategories.slice(0, 10))
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
        console.log(`[API] Fetching ${batches} batches in parallel for limit=${limit}, offset=${offset}, hasFilters=${hasFilters}`)
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
          } catch (error: any) {
            if (attempt === retries) {
              if (process.env.NODE_ENV === 'development') {
                console.error(`[API] Batch ${batchIndex} failed after ${retries + 1} attempts:`, error?.message || error)
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
              console.log(`[API] Batch ${i}: Got ${data.length} items (range: ${offset + (i * SUPABASE_MAX_LIMIT)}-${offset + (i * SUPABASE_MAX_LIMIT) + data.length - 1})`)
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[API] Batch ${i}: No data returned`)
            }
            failedBatches++
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[API] Batch ${i} promise rejected:`, result.reason)
          }
          failedBatches++
        }
      }
      
      // Log summary
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API] Batch fetch complete: ${successfulBatches}/${batches} successful, ${failedBatches} failed, total items: ${totalItems}, requested: ${limit}`)
      }
      
      // If we got significantly fewer results than expected, log a warning
      if (totalItems < limit * 0.5 && successfulBatches < batches) {
        console.warn(`[API] ⚠️ Only fetched ${totalItems} items out of ${limit} requested. ${failedBatches} batches failed.`)
      }
      
      // Sort by popularity after parallel fetch (maintain order)
      allData.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    }
    
    if (allData.length === 0) {
      // Fallback to external sources only if Supabase is completely empty
      console.log('Supabase returned no data, trying external sources...')
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
    const aiEntries: AIEntry[] = allData.map(transformToAIEntry)
    
    // Log response size for debugging
    if (process.env.NODE_ENV === 'development') {
      const responseSize = JSON.stringify(aiEntries).length
      const responseSizeMB = (responseSize / 1024 / 1024).toFixed(2)
      console.log(`[API] Returning ${aiEntries.length} tools, response size: ${responseSizeMB} MB (requested: ${limit})`)
      
      // Check if response might be too large (Vercel has ~4.5MB limit)
      if (responseSize > 4 * 1024 * 1024) {
        console.warn(`[API] ⚠️ Response size (${responseSizeMB} MB) is approaching Vercel's 4.5MB limit!`)
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
    console.error('Error in /api/ai-models:', error)
    
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

