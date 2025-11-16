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
  const limit = parseInt(searchParams.get('limit') || '500') // Default to 500 for faster response
  const offset = parseInt(searchParams.get('offset') || '0')
  
  try {
    const supabase = getSupabaseAdmin()
    const SUPABASE_MAX_LIMIT = 1000 // Supabase PostgREST default max per query
    
    // Build base query for filters
    const buildBaseQuery = (queryBuilder: any) => {
      if (category) queryBuilder = queryBuilder.eq('category', category)
      if (region) queryBuilder = queryBuilder.eq('region', region)
      if (accessType) queryBuilder = queryBuilder.eq('access_type', accessType)
      if (search) {
        queryBuilder = queryBuilder.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }
      return queryBuilder
    }
    
    let allData: any[] = []
    
    // Fast path: single query for small requests
    if (limit <= SUPABASE_MAX_LIMIT) {
      let query = supabase
        .from('ai_tools')
        .select('*')
        .order('popularity', { ascending: false })
        .range(offset, offset + limit - 1)
      
      query = buildBaseQuery(query)
      
      const { data, error } = await query
      
      if (error) {
        console.error('Supabase query error:', error)
        throw error
      }
      
      if (data) {
        allData = data
      }
    } else {
      // Batch fetching for large requests - use parallel fetching for speed
      const batches = Math.ceil(limit / SUPABASE_MAX_LIMIT)
      
      // Fetch batches in parallel (much faster than sequential)
      const batchPromises = []
      for (let i = 0; i < batches; i++) {
        const batchOffset = offset + (i * SUPABASE_MAX_LIMIT)
        const batchLimit = Math.min(SUPABASE_MAX_LIMIT, limit - (i * SUPABASE_MAX_LIMIT))
        
        let batchQuery = supabase
          .from('ai_tools')
          .select('*')
          .order('popularity', { ascending: false })
          .range(batchOffset, batchOffset + batchLimit - 1)
        
        batchQuery = buildBaseQuery(batchQuery)
        batchPromises.push(batchQuery)
      }
      
      // Execute all batches in parallel
      const batchResults = await Promise.allSettled(batchPromises)
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const { data, error } = await result.value
          if (error) {
            console.error('Supabase batch error:', error)
            continue // Continue with other batches
          }
          if (data && data.length > 0) {
            allData.push(...data)
          }
        } else {
          console.error('Batch promise rejected:', result.reason)
        }
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

