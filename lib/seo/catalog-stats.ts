import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Public catalog figures, for anywhere that states a number out loud.
 *
 * WHY THIS IS ITS OWN MODULE
 *
 * The landing page used to claim "7K+ AI Tools" as a hard-coded fallback and,
 * when the live figure loaded, rendered the ROW count instead. Measured
 * 2026-09-21:
 *
 *     rows in ai_tools     272,755
 *     distinct products     15,210
 *     duplicate rows       257,545   (94.4%)
 *     with a public page     2,913
 *
 * So the page was liable to advertise "272.7K+" while the directory behind it
 * could show 2,913 — and Google was separately quoting "Over 25,000", a number
 * matching nothing. One loader, one definition, used by every surface that
 * says a number, so they cannot drift apart again.
 *
 * The count is DISTINCT PRODUCTS, because that is what a visitor can actually
 * find: `search_tools_advanced` applies DISTINCT ON (normalized name), so the
 * duplicates are invisible in search and must not be counted in the headline.
 */
export interface CatalogStats {
  /** Distinct products in the catalog. The honest headline figure. */
  toolCount: number
  /** Distinct products with a public page at /tools/<slug>. */
  published: number
  /** Categories with public landing pages. */
  categories: number
}

/** Every figure zero: the shape callers render a placeholder for. */
const UNKNOWN: CatalogStats = { toolCount: 0, published: 0, categories: 0 }

/**
 * How long a server instance reuses the figures.
 *
 * The underlying RPC already caches in a table and recomputes at most daily;
 * this just avoids a round trip per render. Deliberately generous: these are
 * displayed rounded to a whole number and change by single digits a day.
 */
const TTL_MS = 60 * 60 * 1000

let cached: { at: number; data: CatalogStats } | null = null
let inflight: Promise<CatalogStats> | null = null

async function load(): Promise<CatalogStats> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('catalog_stats_current')

  if (error) {
    if (error.message?.includes('Could not find the function')) {
      throw new Error(
        'catalog_stats_current() is missing. Apply supabase/migrations/add_catalog_stats.sql.'
      )
    }
    throw new Error(error.message)
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    toolCount: Number(row?.distinct_products) || 0,
    published: Number(row?.published) || 0,
    categories: Number(row?.categories) || 0,
  }
}

/**
 * Catalog figures, or zeroes if they cannot be read.
 *
 * Never throws and never guesses. A page that states a number must be able to
 * render without one — the callers show an em dash — because the failure this
 * whole module exists to prevent is a plausible-looking figure that nothing
 * backs up. A build with no database secrets takes the same path.
 */
export async function getCatalogStats(): Promise<CatalogStats> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data
  if (inflight) return inflight

  inflight = load()
    .then((data) => {
      cached = { at: Date.now(), data }
      return data
    })
    .catch((error) => {
      console.error('[catalog-stats] unavailable, rendering without figures:', error)
      return UNKNOWN
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}
