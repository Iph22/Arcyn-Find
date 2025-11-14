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
    // Always start with static data (curated popular products like Claude, GPT-4, Copilot)
    let allModels = [...aiEntries]
    
    // Try to fetch from external sources and merge with static data
    const externalModels = await fetchAIModelsFromSources()
    
    if (externalModels.length > 0) {
      // Merge external models with static data
      // Static data entries take priority (they're curated popular products)
      const staticModelNames = new Set(aiEntries.map(m => m.name.toLowerCase().trim()))
      
      // Only add external models that don't already exist in static data
      const newExternalModels = externalModels.filter(
        m => !staticModelNames.has(m.name.toLowerCase().trim())
      )
      
      // Combine: static data first (prioritized), then new external models
      allModels = [...aiEntries, ...newExternalModels]
      
      console.log(`Merged ${aiEntries.length} static models with ${newExternalModels.length} external models`)
    } else {
      console.log('External sources returned no data, using static data only')
    }

    return NextResponse.json(allModels, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error in /api/ai-models:', error)
    
    // Return static data as fallback (always includes Claude, GPT-4, Copilot, etc.)
    return NextResponse.json(aiEntries, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  }
}

