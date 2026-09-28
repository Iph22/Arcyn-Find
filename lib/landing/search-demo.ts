/**
 * The tools shown in the homepage's browser animation.
 *
 * These come from the live catalog, run through the same search the product
 * uses. The animation previously typed "Find and filter the best AI tools for
 * developers" and returned DevAssistant Pro, CodeGenius AI and DebugMaster
 * 3000 — none of which exist. That is the same problem app/page.tsx already
 * solved for the headline figures: a hero that invents its own content is
 * advertising a product that isn't the one behind the sign-in.
 *
 * The query is editorial and fixed; the results are whatever the catalog
 * actually returns for it today. If the catalog changes, the hero changes
 * with it, which is the point.
 */

import { getSupabaseAdmin } from '@/lib/supabase'
import { getFeaturedTools, isIndexable } from '@/lib/seo/catalog'

/**
 * Chosen by measurement, not taste. Candidate queries were run against the
 * live RPC and scored on how many results cleared `isIndexable`:
 *
 *   meeting notes and summaries       7   <- this one
 *   design logos and branding         9   near-duplicate names
 *   edit photos online                9   near-duplicate names
 *   create presentations and slides   5
 *   ai video editing                  3
 *   ai image generator                0
 *
 * "design logos and branding" scored higher but returns AI Logo Maker, AI
 * Logobrainstorm, Relogoai and Logo Theme AI — four near-identical names read
 * as a data problem rather than a directory. This query returns distinct,
 * recognisable products.
 */
export const DEMO_QUERY = 'meeting notes and summaries'

/** How many result rows the animation renders. */
const DEMO_RESULT_COUNT = 3

export interface DemoResult {
  name: string
  description: string
  /** "Free", "Freemium", "Paid". Shown instead of the category, which is
   *  unreliable — docs/CORPUS_AND_CONSTRAINTS.md §1 — and would caption a
   *  meeting-notes tool as "Code & Development" on the homepage. */
  accessType: string | null
}

export interface LandingSearchDemo {
  query: string
  results: DemoResult[]
}

interface SearchRow {
  name: string
  description: string | null
  tags: string[] | null
  image: string | null
  platform: string | null
  access_type: string | null
}

function toDemoResult(row: SearchRow): DemoResult {
  return {
    name: row.name,
    description: (row.description ?? '').trim(),
    accessType: row.access_type,
  }
}

/**
 * Never throws and never returns a fabricated tool. A failure degrades to the
 * featured list, and then to an empty array — the animation renders the search
 * box without results rather than inventing any.
 */
export async function getLandingSearchDemo(): Promise<LandingSearchDemo> {
  try {
    const supabase = getSupabaseAdmin()

    // All five arguments, including the nulls. Two overloads of this function
    // exist in the database — the four-argument version was never dropped when
    // `extra_keywords` was added — and PostgREST refuses to choose between
    // them unless every parameter is named:
    //   "Could not choose the best candidate function between: ..."
    const { data, error } = await supabase.rpc('search_tools_advanced', {
      search_query: DEMO_QUERY,
      query_embedding: null, // FTS tier only: no embedding, so no Gemini quota
      match_threshold: 0.2,
      match_count: 12,
      extra_keywords: null,
    })

    if (error) throw new Error(error.message)

    const results = ((data ?? []) as SearchRow[])
      .filter((row) =>
        isIndexable({
          // `name` is required since isIndexable started applying the content
          // rating, which reads it -- the landing demo is the last place an
          // adult result should surface.
          name: row.name ?? '',
          rawDescription: row.description ?? '',
          tags: row.tags ?? [],
          image: row.image,
          platform: row.platform,
        })
      )
      .slice(0, DEMO_RESULT_COUNT)
      .map(toDemoResult)

    if (results.length > 0) return { query: DEMO_QUERY, results }
  } catch (error) {
    console.error('[landing/search-demo] search failed, falling back:', error)
  }

  try {
    const featured = await getFeaturedTools(DEMO_RESULT_COUNT)
    return {
      query: DEMO_QUERY,
      results: featured.map((tool) => ({
        name: tool.name,
        description: tool.description,
        accessType: tool.accessType,
      })),
    }
  } catch (error) {
    console.error('[landing/search-demo] featured fallback failed too:', error)
    return { query: DEMO_QUERY, results: [] }
  }
}
