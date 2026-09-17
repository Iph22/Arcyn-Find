/**
 * Cron Job: Send the notification digest
 *
 * Mails the current digest to every opted-in user with a deliverable address.
 * Intended to run weekly; see `.github/workflows/cron-send-digest.yml`.
 *
 * Safe to re-run. Recipients are claimed per ISO week in `notification_log`
 * before anything is sent, so a second invocation inside the same week mails
 * only the people the first one did not reach. That is what makes the
 * alert-on-failure workflow actionable: the fix for a partial run is to press
 * the button again.
 */

import { NextResponse } from 'next/server'
import { sendDigest } from '@/lib/notifications/send-digest'
import { logger } from '@/lib/logger'

export const maxDuration = 60 // 60 seconds max
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    // Security: Check for Cron Secret
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    const authHeader = req.headers.get('authorization')

    const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-key'

    if (authHeader !== `Bearer ${CRON_SECRET}` && key !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()

    try {
        logger.info('[Cron:SendDigest] Starting digest send...')

        const result = await sendDigest()

        logger.info(
            `[Cron:SendDigest] key=${result.digestKey} tools=${result.toolCount} ` +
            `new=${result.isNew} attempted=${result.attempted} sent=${result.sent} ` +
            `failed=${result.failed} skipped=${result.skipped} in ${result.elapsedMs}ms`
        )

        if (result.toolCount === 0) {
            // Said out loud rather than reported as a successful no-op. An empty
            // candidate set means the content query stopped matching -- a schema
            // change, or the popularity band drifting -- and a digest that
            // quietly stops going out looks identical to one nobody opens.
            logger.warn('[Cron:SendDigest] no tools qualified; nothing was sent')
        }

        if (result.budgetExhausted) {
            // Not an error: claiming is per-period, so the remaining recipients
            // are untouched and the next run continues from here. Visible so a
            // list that never finishes draining is noticed rather than assumed.
            logger.warn(
                '[Cron:SendDigest] stopped on the time budget with recipients ' +
                'remaining; re-run inside the same week to continue.'
            )
        }

        if (result.failed > 0) {
            logger.warn(`[Cron:SendDigest] ${result.failed} recipient(s) failed; see notification_log`)
        }

        return NextResponse.json({
            success: true,
            ...result,
            duration: Date.now() - startTime,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger.error('[Cron:SendDigest] failed:', message)

        // Non-2xx so `curl --fail` in the workflow trips and the alert step
        // opens an issue. A 200 with an error body would be invisible.
        return NextResponse.json(
            { success: false, error: message, duration: Date.now() - startTime },
            { status: 500 }
        )
    }
}
