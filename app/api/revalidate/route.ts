import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase'
import { slugify } from '@/lib/seo/slug'
import { logger } from '@/lib/logger'

/**
 * POST /api/revalidate?slug=<tool-slug>
 *
 * Push a data change onto the public site without waiting for ISR.
 *
 * WHY THIS EXISTS
 *
 * Editing a row and waiting is the whole problem. Measured 2026-09-28, a
 * single correction takes this long to become visible:
 *
 *     /tools/<slug>            2 hours     (revalidate = 7200)
 *     /tools/category/<slug>   2 hours
 *     /tools                   1 hour
 *     /                        1 hour
 *     /sitemap.xml            24 hours     (revalidate = 86400)
 *
 * So a vendor who writes in to correct their pricing is told it is fixed, and
 * sees the old figure for the rest of the day. The sitemap is the worst of it:
 * a newly publishable tool is invisible to Google for a day after the row is
 * right.
 *
 * WHAT THIS DOES NOT FIX
 *
 * `revalidatePath` clears Next's cache. It does not clear the in-process
 * catalog cache in lib/seo/catalog.ts, which is `sharedWithTtl(1 hour)` held
 * in a serverless instance's memory and reachable from nowhere else. Pages
 * that read a single row -- the tool page -- are unaffected, because
 * `getToolBySlug` is per-request `cache()` and goes to the database every
 * render. Pages built from the full catalog walk -- the sitemap, the
 * directory -- can still serve up to an hour old on an instance that already
 * has it. That is a real limit, not an oversight: the alternative is dropping
 * a cache that exists because the walk is 3-4MB.
 *
 * NOTES ON THE API
 *
 * Route handlers MARK a path for revalidation; the work happens on the next
 * visit. So a 200 here means "queued", not "regenerated" -- verify by
 * fetching the page, not by trusting this response.
 *
 * With a rewrite, the DESTINATION path is what must be revalidated. Revalidating
 * `/sitemap.xml` therefore covers `/sitemap-1.xml`, which next.config.ts
 * rewrites onto it; revalidating `/sitemap-1.xml` would do nothing.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // No `|| 'dev-cron-key'` fallback, unlike the cron routes.
  //
  // Those read data; this one purges caches, so a guessable default would let
  // anyone force the catalog walk to re-run on demand. An unset secret fails
  // closed rather than falling back to a string that is in the repository.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    logger.error('[revalidate] CRON_SECRET is not set; refusing to revalidate')
    return NextResponse.json({ error: 'Revalidation is not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slug = searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  try {
    // Look the tool up rather than trusting the caller: the category page to
    // refresh depends on the row, and revalidating a path for a tool that does
    // not exist would silently do nothing while returning 200.
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('ai_tools')
      .select('slug, category')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) {
      return NextResponse.json({ error: `No published tool with slug "${slug}"` }, { status: 404 })
    }

    const categorySlug = data.category ? slugify(data.category) : ''
    const paths = [
      `/tools/${slug}`,
      ...(categorySlug ? [`/tools/category/${categorySlug}`] : []),
      '/tools',
      '/tools/category',
      '/',
      // Covers /sitemap-1.xml too -- it is a rewrite onto this path.
      '/sitemap.xml',
      '/sitemap-index.xml',
    ]

    for (const path of paths) revalidatePath(path)

    logger.info('[revalidate] queued', { slug, paths })
    return NextResponse.json({
      revalidated: paths,
      slug,
      // Said plainly, because a 200 from this route is easy to over-read.
      note:
        'Paths are marked for revalidation and regenerate on next visit. ' +
        'Catalog-wide pages may still serve up to an hour old from an ' +
        'instance that already holds the in-process catalog cache.',
    })
  } catch (err) {
    logger.error('[revalidate] failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Revalidation failed' },
      { status: 500 }
    )
  }
}
