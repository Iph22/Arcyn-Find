import { NextResponse } from 'next/server'
import { getCatalogStats } from '@/lib/seo/catalog-stats'
import { logger } from '@/lib/logger'

/**
 * GET /api/tools/count
 *
 * Catalog figures for the landing page.
 *
 * `count` is the number of DISTINCT PRODUCTS, not the number of rows. That
 * distinction is the whole point of this route. It previously returned the
 * planner's row estimate — 272,753 — and the landing page rendered it as
 * "272.7K+ AI Tools". Measured on 2026-09-21 by walking the table:
 *
 *     rows in ai_tools     272,755
 *     distinct products     15,210
 *     duplicate rows       257,545   (94.4%)
 *     with a public page     2,913
 *
 * So the old figure overstated the catalog roughly 18-fold, while a visitor
 * browsing the public directory could only reach 2,913 tools. Claiming a
 * number the site cannot show is what made it look like it was inflating.
 *
 * The heavy COUNT(DISTINCT ...) lives in catalog_stats_current(), which caches
 * its result in a table and recomputes at most once a day. See
 * supabase/migrations/add_catalog_stats.sql.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface CatalogCounts {
  /** Distinct products. The honest headline figure. */
  count: number
  /** Distinct products with a public page at /tools/<slug>. */
  published: number
  /** Categories with public landing pages. */
  categories: number
}

const EMPTY: CatalogCounts = { count: 0, published: 0, categories: 0 }

export async function GET() {
  try {
    // Through getCatalogStats(), not the RPC directly.
    //
    // This route called `catalog_stats_current()` itself, which is a second
    // definition of the same three numbers -- and they had already drifted.
    // The RPC counts every distinct category over published rows; the landing
    // pages group by slug and require MIN_CATEGORY_SIZE members. On
    // 2026-09-23 that was 23 here against 21 on the pages a visitor can open.
    //
    // lib/seo/catalog-stats.ts says it is "one loader, one definition, used by
    // every surface that says a number, so they cannot drift apart again".
    // This route was the surface that was not using it.
    const stats = await getCatalogStats()

    const payload: CatalogCounts = {
      count: stats.toolCount,
      published: stats.published,
      categories: stats.categories,
    }

    return NextResponse.json(payload, {
      headers: {
        // A day. The ingest adds rows daily at most, and these are displayed
        // rounded, so a fresher number would not change a pixel.
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (error) {
    logger.error('[CatalogCounts] failed:', error)

    // 200 with zeroes rather than an error status: these are decoration, and
    // the page renders a placeholder for a zero. Critically it must NOT fall
    // back to a made-up figure — showing an invented number is the exact
    // problem this route was rewritten to fix.
    return NextResponse.json(EMPTY, {
      headers: { 'Cache-Control': 'public, s-maxage=300' },
    })
  }
}
