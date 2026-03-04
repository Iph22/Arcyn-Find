import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { correctTypos, normalizeQuery } from '@/lib/search-utils'

export const runtime = 'nodejs'

// In-memory cache for suggestions (refreshed every 5 minutes)
let suggestionsCache: { data: string[], timestamp: number } | null = null
const CACHE_TTL = 1000 * 60 * 5 // 5 minutes

/**
 * GET /api/search/suggest?q=...
 * 
 * Ultra-fast autocomplete endpoint (<50ms target).
 * Returns tool names and categories that match the query prefix.
 * No Gemini calls — pure database queries for speed.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
        return NextResponse.json({ suggestions: [], corrected: null }, {
            headers: { 'Cache-Control': 'public, s-maxage=60' },
        })
    }

    const supabase = getSupabaseAdmin()
    const normalized = normalizeQuery(q)
    const corrected = correctTypos(normalized)
    const didCorrect = corrected !== normalized
    const searchTerm = didCorrect ? corrected : normalized

    try {
        // 1. Fast prefix search on tool names (indexed, very fast)
        const { data: nameMatches } = await supabase
            .from('ai_tools')
            .select('name')
            .ilike('name', `%${searchTerm}%`)
            .order('popularity', { ascending: false })
            .limit(5)

        // 2. Check popular past searches from cache table
        let popularSearches: string[] = []
        try {
            const { data: cached } = await supabase
                .from('search_cache')
                .select('query_text, use_count')
                .ilike('query_text', `%${searchTerm}%`)
                .order('use_count', { ascending: false })
                .limit(3)

            if (cached) {
                popularSearches = cached.map(c => c.query_text)
            }
        } catch {
            // search_cache table might not exist yet
        }

        // 3. Category matches
        const categories = [
            "AI Agents", "Code & Development", "Chatbots", "Writing & Content",
            "Image Generation", "Productivity", "Audio & Music", "Data & Analytics",
            "Education", "Marketing", "Video Generation", "AI Detection",
            "HR & Recruiting", "Customer Service", "Translation", "Research",
            "Healthcare", "Finance", "Gaming", "3D & Spatial", "Computer Vision",
            "Generative AI", "NLP & Text Analysis"
        ]

        const matchingCategories = categories
            .filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
            .slice(0, 2)

        // Combine and deduplicate suggestions
        const suggestions: string[] = []
        const seen = new Set<string>()

        // Tool names first (most relevant)
        for (const match of (nameMatches || [])) {
            const name = match.name
            if (!seen.has(name.toLowerCase())) {
                seen.add(name.toLowerCase())
                suggestions.push(name)
            }
        }

        // Then popular searches
        for (const search of popularSearches) {
            if (!seen.has(search.toLowerCase())) {
                seen.add(search.toLowerCase())
                suggestions.push(search)
            }
        }

        // Then categories (prefixed)
        for (const cat of matchingCategories) {
            const prefixed = `${cat} tools`
            if (!seen.has(prefixed.toLowerCase())) {
                seen.add(prefixed.toLowerCase())
                suggestions.push(prefixed)
            }
        }

        return NextResponse.json({
            suggestions: suggestions.slice(0, 8),
            corrected: didCorrect ? corrected : null,
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
            },
        })
    } catch (error) {
        console.error('[Suggest API] Error:', error)
        return NextResponse.json({ suggestions: [], corrected: null }, { status: 200 })
    }
}
