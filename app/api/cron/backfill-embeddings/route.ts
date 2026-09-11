/**
 * Cron: fill in missing tool embeddings.
 *
 * WHY A CRON: the backfill cannot finish in one sitting. Embeddings share the
 * Gemini quota with every reasoning call in the app, so a run of a few hundred
 * rows exhausts what is available and the rest has to wait for the quota to
 * reset. Doing that by hand means someone remembering to re-run a script daily
 * for weeks; on a schedule, coverage climbs on its own.
 *
 * Coverage matters because the semantic tier of search_tools_advanced requires
 * `embedding IS NOT NULL` — measured at 11% of the 2000 most-viewed rows, which
 * is why a query like "schedule social media posts" returned a tweeting browser
 * extension while SocialBee (popularity 100) was unreachable by meaning.
 *
 * SAFE TO CALL REPEATEDLY AND OFTEN. It processes the most-popular rows that
 * still lack an embedding, so successive calls make progress with no cursor to
 * keep; and it stops early on both a time budget and a run of failures, so a
 * call during an exhausted quota is cheap rather than destructive.
 *
 * Suggested schedule: hourly. Each run is small by design — finishing sooner is
 * not possible while the quota is the constraint, and a large batch would
 * starve the recommendation path of the same quota.
 *
 *   GET /api/cron/backfill-embeddings?key=$CRON_SECRET
 *   GET /api/cron/backfill-embeddings   (Authorization: Bearer $CRON_SECRET)
 *
 * Optional: &limit=25 to override the batch size.
 */

import { NextResponse } from 'next/server'
import { backfillEmbeddings } from '@/lib/embedding-backfill'
import { logger } from '@/lib/logger'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Rows per run. Each embedding costs roughly 1.3s measured, so 25 fits inside
 * the 60s duration cap with headroom for the initial fetch (~5s) — and the time
 * budget below is the real guard, not this number.
 */
const DEFAULT_LIMIT = 25

/** Leave headroom under maxDuration so the response is returned rather than the
 *  function being killed mid-write. */
const TIME_BUDGET_MS = 45_000

export async function GET(request: Request) {
    // Same auth as the other cron routes: Bearer token or ?key=.
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const authHeader = request.headers.get('authorization')
    const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-key'

    if (authHeader !== `Bearer ${CRON_SECRET}` && key !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requested = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : DEFAULT_LIMIT

    try {
        const result = await backfillEmbeddings({ limit, timeBudgetMs: TIME_BUDGET_MS })

        logger.info(
            `[Cron:BackfillEmbeddings] wrote ${result.written}, failed ${result.failed}` +
            `${result.quotaExhausted ? ' (quota exhausted)' : ''}${result.timedOut ? ' (time budget reached)' : ''}`
        )

        return NextResponse.json({
            ok: true,
            ...result,
            // Nothing left to do is a success, and worth saying plainly so a
            // monitoring dashboard does not read "wrote 0" as a failure.
            complete: result.attempted === 0,
            note:
                result.attempted === 0
                    ? 'No rows are missing an embedding — backfill is complete.'
                    : result.quotaExhausted
                        ? 'Stopped early: the embedding quota looks exhausted. The next run will continue.'
                        : undefined,
        })
    } catch (error) {
        logger.error('[Cron:BackfillEmbeddings] unexpected error:', error)
        return NextResponse.json({ error: 'Backfill failed.' }, { status: 500 })
    }
}
