import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { getCurrentUser } from '@/lib/google-auth'
import { normalizeCacheKey } from '@/lib/recommendation-cache'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const FeedbackSchema = z.object({
    query: z.string().min(1).max(500),
    toolId: z.string().min(1).max(200),
    slot: z.enum(['best_match', 'alternative']).default('best_match'),
    verdict: z.enum(['up', 'down']),
    reason: z
        .enum(['not_relevant', 'too_expensive', 'missing_feature', 'better_alternative', 'wrong_category', 'other'])
        .nullish(),
})

/**
 * POST /api/recommend/feedback
 *
 * Records whether a recommendation was useful. This is the only source of real
 * quality judgement on recommendations — the synthetic eval's relevance check
 * is a loose substring match that scored 100% while still surfacing "TLDR" for
 * "find and fix bugs in my codebase".
 *
 * Deliberately works ANONYMOUSLY. Requiring sign-in would collapse the volume
 * of the signal; a signed-in user gets one vote per (query, tool) enforced by a
 * partial unique index, while anonymous submissions are bounded by rate limit.
 */
export async function POST(request: Request) {
    const rateLimit = checkRateLimit(request, {
        windowMs: 60 * 1000,
        maxRequests: 20,
    })
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again shortly.' },
            { status: 429, headers: getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime) }
        )
    }

    let parsed: z.infer<typeof FeedbackSchema>
    try {
        parsed = FeedbackSchema.parse(await request.json())
    } catch (error) {
        const issues = error instanceof z.ZodError ? error.issues.slice(0, 3) : undefined
        return NextResponse.json({ error: 'Invalid feedback payload.', issues }, { status: 400 })
    }

    // A 'down' verdict may carry a reason; an 'up' verdict never should.
    const reason = parsed.verdict === 'down' ? (parsed.reason ?? null) : null

    // Anonymous is fine — see the note above.
    let userId: string | null = null
    try {
        const user = await getCurrentUser()
        userId = user?.id ?? null
    } catch {
        // Auth failure is not a reason to drop feedback.
    }

    try {
        const supabase = getSupabaseAdmin()
        const row = {
            query_text: normalizeCacheKey(parsed.query),
            tool_id: parsed.toolId,
            slot: parsed.slot,
            verdict: parsed.verdict,
            reason,
            user_id: userId,
        }

        // For signed-in users this replaces their previous vote on the same
        // (query, tool) via the partial unique index. Anonymous rows have a
        // NULL user_id, which doesn't participate in that index, so they insert.
        const { error } = userId
            ? await supabase
                .from('recommendation_feedback')
                .upsert(row, { onConflict: 'user_id,query_text,tool_id' })
            : await supabase.from('recommendation_feedback').insert(row)

        if (error) {
            if (error.message?.includes('does not exist')) {
                logger.warn('[Feedback] recommendation_feedback table missing — run add_recommendation_feedback.sql')
                return NextResponse.json({ error: 'Feedback is not available yet.' }, { status: 503 })
            }
            logger.error('[Feedback] insert failed:', error.message)
            return NextResponse.json({ error: 'Could not record feedback.' }, { status: 500 })
        }

        return NextResponse.json(
            { ok: true },
            { headers: getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime) }
        )
    } catch (error) {
        logger.error('[Feedback] unexpected error:', error)
        return NextResponse.json({ error: 'Could not record feedback.' }, { status: 500 })
    }
}
