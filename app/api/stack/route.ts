import { NextResponse } from 'next/server'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { buildStack } from '@/lib/stack'
import { getCachedStack, setCachedStack } from '@/lib/stack-cache'
import { logger } from '@/lib/logger'

// One model call plus N parallel retrievals. Same headroom reasoning as
// /api/recommend: the expensive work runs after validation, not instead of it.
export const maxDuration = 30
export const runtime = 'nodejs'

const MAX_GOAL_LENGTH = 500

/**
 * POST /api/stack
 *
 * Phase 3 "Solution Architect" endpoint: given a goal, return the sequence of
 * tools needed to accomplish it, with a combined monthly cost.
 *
 * OPT-IN, not automatic. It is not folded into /api/recommend because it costs
 * a model call plus one retrieval per step, and the Gemini quota is already the
 * binding constraint on the recommendation path — the eval has been measuring
 * `reasoned 0%` for most of this work. Making every search build a stack would
 * spend that budget on users who did not ask for one. The UI triggers this from
 * an explicit "Build my stack" action.
 *
 * Rate limited harder than /api/recommend (10/min vs 30/min) for the same
 * reason: each call is several times more expensive.
 */
export async function POST(request: Request) {
    const requestStart = Date.now()

    const rateLimit = checkRateLimit(request, {
        windowMs: 60 * 1000,
        maxRequests: 10,
    })
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again shortly.' },
            { status: 429, headers: getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime) }
        )
    }

    let goal: string
    try {
        const body = await request.json()
        goal = typeof body?.goal === 'string' ? body.goal.trim() : ''
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body — expected JSON with a "goal" string.' },
            { status: 400 }
        )
    }

    if (!goal) {
        return NextResponse.json({ error: 'goal is required.' }, { status: 400 })
    }
    if (goal.length > MAX_GOAL_LENGTH) {
        return NextResponse.json(
            { error: `goal must be ${MAX_GOAL_LENGTH} characters or fewer.` },
            { status: 400 }
        )
    }

    // Same eval bypass as /api/recommend, and gated identically — an open
    // bypass is a way to force the expensive path on every request.
    const bypassCache =
        new URL(request.url).searchParams.get('fresh') === '1' &&
        (process.env.NODE_ENV !== 'production' ||
            (Boolean(process.env.ADMIN_API_KEY) &&
                request.headers.get('x-admin-key') === process.env.ADMIN_API_KEY))

    const cached = bypassCache ? null : await getCachedStack(goal)
    if (cached) {
        return NextResponse.json(cached, {
            headers: {
                ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
                'Cache-Control': 'private, no-store',
                'X-Stack-Cache': 'hit',
                'X-Stack-Elapsed-Ms': String(Date.now() - requestStart),
            },
        })
    }

    try {
        const stack = await buildStack(goal)

        // Cache only a real stack. Caching a degraded result would pin
        // "temporarily unavailable" in place for the full TTL — the same
        // mistake the recommendation cache explicitly avoids, and the reason we
        // cache at all is that quota exhaustion causes those degradations.
        const worthCaching = !stack.degraded && stack.steps.some(s => s.tool)
        if (worthCaching) {
            void setCachedStack(goal, stack)
        }

        return NextResponse.json(stack, {
            headers: {
                ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
                'Cache-Control': 'private, no-store',
                'X-Stack-State': stack.steps.length === 0 ? 'empty' : 'full',
                'X-Stack-Steps': String(stack.steps.length),
                'X-Stack-Filled': String(stack.steps.filter(s => s.tool).length),
                'X-Stack-Degraded': String(stack.degraded),
                'X-Stack-Cache': bypassCache
                    ? (worthCaching ? 'bypass-stored' : 'bypass-not-cached')
                    : (worthCaching ? 'miss-stored' : 'miss-not-cached'),
                'X-Stack-Elapsed-Ms': String(Date.now() - requestStart),
            },
        })
    } catch (error) {
        logger.error('[Stack] Unexpected error:', error)
        return NextResponse.json(
            { error: 'Could not build a stack for this goal.' },
            { status: 500 }
        )
    }
}
