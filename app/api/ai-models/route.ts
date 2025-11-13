import { NextResponse } from 'next/server'
import { fetchAIModelsFromSources } from '@/lib/data-sources'
import { aiEntries } from '@/lib/ai-data'

/**
 * GET /api/ai-models
 * Fetches AI models from external sources
 * Falls back to static data if external sources fail
 */
export async function GET() {
  try {
    // Try to fetch from external sources
    const externalModels = await fetchAIModelsFromSources()

    // If we got results from external sources, return them
    if (externalModels.length > 0) {
      return NextResponse.json(externalModels, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      })
    }

    // Fallback to static data if external sources failed
    console.warn('External sources returned no data, using static fallback')
    return NextResponse.json(aiEntries, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error in /api/ai-models:', error)
    
    // Return static data as fallback
    return NextResponse.json(aiEntries, {
      status: 200, // Still return 200, but with fallback data
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  }
}

