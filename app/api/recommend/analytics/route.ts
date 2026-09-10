import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

/** Rows pulled per request. Aggregation happens in JS rather than SQL because
 *  there is no aggregate RPC for this table, and adding one for a table that
 *  will hold thousands of rows rather than millions buys nothing. The cap
 *  exists so this endpoint can never become the slow query — and when it is
 *  hit the response says so, rather than quietly reporting a partial count as
 *  a total. */
const MAX_ROWS = 5000

/** Below this, a tool's or query's up-rate is noise. Exposed as a threshold in
 *  the response instead of applied invisibly, so the caller can see what was
 *  excluded and why. */
const MIN_VOTES_FOR_RANKING = 3

interface FeedbackRow {
    query_text: string
    tool_id: string
    slot: string
    verdict: string
    reason: string | null
    user_id: string | null
    created_at: string
}

interface Tally {
    up: number
    down: number
}

const emptyTally = (): Tally => ({ up: 0, down: 0 })

function bump(map: Map<string, Tally>, key: string, verdict: string) {
    const tally = map.get(key) ?? emptyTally()
    if (verdict === 'up') tally.up++
    else tally.down++
    map.set(key, tally)
}

/** Up-rate as a 0-1 fraction, or null when there are no votes — never 0,
 *  which would read as "everyone hated it" instead of "nobody voted". */
function rate(tally: Tally): number | null {
    const total = tally.up + tally.down
    return total === 0 ? null : Math.round((tally.up / total) * 100) / 100
}

/**
 * GET /api/recommend/analytics
 *
 * Turns the raw feedback table into the numbers that drive ranking work. Each
 * block answers a specific question rather than being a generic dump:
 *
 *   overall / bySlot    is the top pick wrong, or are the alternatives weak?
 *                       Those need different fixes — retrieval vs reasoning.
 *   downVoteReasons     WHY down votes happen. "too_expensive" points at
 *                       price-aware ranking, "not_relevant" at retrieval.
 *   worstTools          demotion candidates.
 *   worstQueries        the queries to hand-label next. This is the intended
 *                       feed into scripts/eval/labels.json, whose whole point
 *                       is grading the cases the synthetic keyword check gets
 *                       wrong.
 *   daily               whether a ranking change helped or hurt.
 *
 * Admin-gated with the same x-admin-key header the existing admin route uses.
 * Query params: days (1-365, default 30), limit (1-50, default 10).
 */
export async function GET(request: Request) {
    const apiKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!expectedKey) {
        // Logged rather than returned: the caller learns nothing about our
        // configuration, while whoever owns the deployment gets a clear reason
        // in the logs instead of debugging a silent 401.
        logger.warn('[RecAnalytics] ADMIN_API_KEY is not set — this endpoint refuses all callers until it is.')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (apiKey !== expectedKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = Math.min(365, Math.max(1, Number.parseInt(searchParams.get('days') ?? '30', 10) || 30))
    const listLimit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') ?? '10', 10) || 10))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('recommendation_feedback')
            .select('query_text, tool_id, slot, verdict, reason, user_id, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(MAX_ROWS)

        if (error) {
            if (error.message?.includes('does not exist')) {
                logger.warn('[RecAnalytics] recommendation_feedback table missing — run add_recommendation_feedback.sql')
                return NextResponse.json({ error: 'Feedback is not available yet.' }, { status: 503 })
            }
            logger.error('[RecAnalytics] query failed:', error.message)
            return NextResponse.json({ error: 'Could not load analytics.' }, { status: 500 })
        }

        const rows = (data ?? []) as FeedbackRow[]

        if (rows.length === 0) {
            // An explicit zero state. Not an error, and not zeros dressed up as
            // findings — nobody has voted in this window yet.
            return NextResponse.json({
                windowDays: days,
                totalVotes: 0,
                message: 'No feedback recorded in this window yet.',
            })
        }

        const overall = emptyTally()
        const bySlot = new Map<string, Tally>()
        const byTool = new Map<string, Tally>()
        const byQuery = new Map<string, Tally>()
        const byDay = new Map<string, Tally>()
        const reasons = new Map<string, number>()
        let signedIn = 0

        for (const row of rows) {
            if (row.verdict === 'up') overall.up++
            else overall.down++

            bump(bySlot, row.slot, row.verdict)
            bump(byTool, row.tool_id, row.verdict)
            bump(byQuery, row.query_text, row.verdict)
            bump(byDay, row.created_at.slice(0, 10), row.verdict)

            if (row.reason) reasons.set(row.reason, (reasons.get(row.reason) ?? 0) + 1)
            if (row.user_id) signedIn++
        }

        // Worst-first, but only among keys with enough votes to mean anything.
        // One down vote is an anecdote, not a signal.
        const worst = (map: Map<string, Tally>) =>
            [...map.entries()]
                .filter(([, tally]) => tally.up + tally.down >= MIN_VOTES_FOR_RANKING)
                .map(([key, tally]) => ({
                    key,
                    votes: tally.up + tally.down,
                    up: tally.up,
                    down: tally.down,
                    upRate: rate(tally),
                }))
                .sort((a, b) => (a.upRate ?? 1) - (b.upRate ?? 1) || b.votes - a.votes)
                .slice(0, listLimit)

        return NextResponse.json({
            windowDays: days,
            generatedAt: new Date().toISOString(),

            // True when the row cap was reached, i.e. these numbers describe
            // only the most recent MAX_ROWS votes inside the window.
            truncated: rows.length >= MAX_ROWS,

            overall: {
                totalVotes: overall.up + overall.down,
                up: overall.up,
                down: overall.down,
                upRate: rate(overall),
                signedInShare: Math.round((signedIn / rows.length) * 100) / 100,
            },

            bySlot: Object.fromEntries(
                [...bySlot.entries()].map(([slot, tally]) => [
                    slot,
                    { votes: tally.up + tally.down, up: tally.up, down: tally.down, upRate: rate(tally) },
                ])
            ),

            downVoteReasons: Object.fromEntries([...reasons.entries()].sort((a, b) => b[1] - a[1])),

            worstTools: worst(byTool).map(({ key, ...rest }) => ({ toolId: key, ...rest })),

            // Hand-label these next; see scripts/eval/labels.json.
            worstQueries: worst(byQuery).map(({ key, ...rest }) => ({ query: key, ...rest })),

            daily: [...byDay.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([day, tally]) => ({ day, up: tally.up, down: tally.down, upRate: rate(tally) })),

            thresholds: {
                minVotesForRanking: MIN_VOTES_FOR_RANKING,
                maxRows: MAX_ROWS,
            },
        })
    } catch (err) {
        logger.error('[RecAnalytics] unexpected error:', err)
        return NextResponse.json({ error: 'Could not load analytics.' }, { status: 500 })
    }
}
