import { NextResponse } from 'next/server'

import { getCategoriesSafe } from '@/lib/seo/catalog'
import { logger } from '@/lib/logger'

/**
 * GET /api/categories
 *
 * The categories that have a public page, for client components that need to
 * link to one. Public, no authentication.
 *
 * This exists because "does /tools/category/<slug> resolve?" is not derivable
 * on the client. Category pages are gated on MIN_CATEGORY_SIZE (20 published
 * tools) and `notFound()` below it, so slugifying a tool's `category` string
 * and linking to it produces a 404 for every small category. Callers check
 * against this list first -- see categoryHref() in lib/tool-href.ts.
 *
 * The underlying read is published_category_stats(), already memoised in
 * process for CATALOG_TTL_MS, so this handler is cheap on a warm lambda. The
 * Cache-Control header is what keeps it cheap on a cold one.
 */
export async function GET() {
  try {
    // getCategoriesSafe degrades to [] rather than throwing. That is the right
    // failure here: a missing category list should cost the category links,
    // not the page they sit on.
    const categories = await getCategoriesSafe()

    return NextResponse.json(
      {
        // Largest first, with a name tiebreak so equal-sized categories do not
        // reorder between requests. Callers take the top N for a fixed-size
        // grid, which is only meaningful if the order is defined.
        categories: categories
          .map((c) => ({ slug: c.slug, name: c.name, count: c.count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      },
      {
        headers: {
          // Matches the hour that /tools and /tools/category already revalidate
          // on; stale-while-revalidate so an expiry never blocks a request.
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (error) {
    logger.error('Error loading categories:', error)
    return NextResponse.json({ categories: [] }, { status: 200 })
  }
}
