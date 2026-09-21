import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * GET /api/tools/count
 *
 * The catalog size, for the landing page headline.
 *
 * This exists so that number stops costing a full table count per visitor.
 * app/page.tsx ran `select('*', { count: 'exact', head: true })` from the
 * browser on every mount -- an exact count over ~263k rows, which
 * docs/CORPUS_AND_CONSTRAINTS.md §2 measured as a shape that times out on this
 * table, to render a figure that is displayed rounded to one decimal place.
 *
 * Two changes: it uses the planner's own row estimate (free, no table access),
 * and it is cached at the CDN for a day, so the database sees roughly one call
 * per day rather than one per visit.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.rpc('ai_tools_estimated_count')

    if (error) throw new Error(error.message)

    // reltuples is -1 on a table that has never been analyzed, and the RPC
    // returns null if the table is missing entirely. Either way there is no
    // number to show, and the page already has a placeholder for that case.
    const count = Number(data)
    const value = Number.isFinite(count) && count > 0 ? count : 0

    return NextResponse.json(
      { count: value },
      {
        headers: {
          // A day. The ingest cron adds rows daily at most, and the figure is
          // rendered rounded -- so a fresher number would not change a pixel.
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    )
  } catch (error) {
    logger.error('[ToolCount] failed:', error)

    // 200 with zero rather than an error status: this is decoration, and the
    // page renders its own placeholder for a zero. A 500 here would put a
    // failed request in the console of every visitor for no benefit.
    return NextResponse.json(
      { count: 0 },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } }
    )
  }
}
