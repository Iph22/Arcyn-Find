/**
 * Storage for contact-form and feedback-widget submissions.
 *
 * Lives here rather than inside the route because a Next.js `route.ts` may
 * only export the request handlers and a fixed set of config values — an extra
 * export from that file is a build error — and because the e2e check needs to
 * exercise exactly the payload the route writes, not a copy of it that can
 * drift.
 *
 * The contract: persist first, email second. Before this existed, /api/contact
 * only sent mail, to a hardcoded address that turned out to be a forwarding
 * alias rather than a mailbox. A submission accepted by Resend and dropped
 * downstream left no trace anywhere. See add_contact_submissions.sql.
 */

import { createHash } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/** The prefix components/feedback-widget.tsx puts on every beta report.
 *  `contactFormSchema` is `.strict()`, so the client has no field of its own
 *  in which to declare a source; the subject line is the only marker. */
export const FEEDBACK_SUBJECT_PREFIX = '[Beta feedback]'

export type EmailStatus = 'pending' | 'sent' | 'failed' | 'not_configured'

export interface EmailOutcome {
    status: Exclude<EmailStatus, 'pending'>
    id?: string
    error?: string
}

export interface SubmissionInput {
    name: string
    email: string
    subject: string
    message: string
    /** Raw client IP; hashed before it is stored, never persisted as-is. */
    ip?: string | null
}

/** Same construction as tool_views.ip_hash: enough to spot one address
 *  flooding the form, not enough to identify anyone. */
export function hashIP(ip: string): string {
    return createHash('sha256').update(ip + 'arcyn-salt').digest('hex').substring(0, 16)
}

export function sourceFor(subject: string): 'feedback_widget' | 'contact_form' {
    return subject.startsWith(FEEDBACK_SUBJECT_PREFIX) ? 'feedback_widget' : 'contact_form'
}

/**
 * Persist a submission before anything that can fail outside this process.
 *
 * Returns the new row's id, or null when the write failed — the caller should
 * still attempt the email in that case, because one surviving copy beats none.
 */
export async function storeSubmission(input: SubmissionInput): Promise<string | null> {
    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('contact_submissions')
            .insert({
                name: input.name,
                email: input.email,
                subject: input.subject,
                message: input.message,
                source: sourceFor(input.subject),
                ip_hash: input.ip ? hashIP(input.ip) : null,
            })
            .select('id')
            .single()

        if (error) {
            if (error.message?.includes('does not exist') || error.code === '42P01') {
                logger.error(
                    '[Contact] contact_submissions table is missing — run add_contact_submissions.sql. ' +
                    'Until then a submission survives only if its email is delivered.'
                )
            } else {
                logger.error('[Contact] Failed to persist submission:', error.message)
            }
            return null
        }

        return data?.id ?? null
    } catch (error) {
        logger.error('[Contact] Unexpected error persisting submission:', error)
        return null
    }
}

/** Best-effort annotation: the submission is already safe by this point. */
export async function recordEmailOutcome(id: string, outcome: EmailOutcome): Promise<void> {
    try {
        const supabase = getSupabaseAdmin()
        const { error } = await supabase
            .from('contact_submissions')
            .update({
                email_status: outcome.status,
                email_id: outcome.id ?? null,
                // Truncated: a provider can return a very long body, and this
                // column is for triage rather than forensics.
                email_error: outcome.error ? outcome.error.slice(0, 1000) : null,
            })
            .eq('id', id)

        if (error) {
            logger.error('[Contact] Could not record email outcome:', error.message)
        }
    } catch (error) {
        logger.error('[Contact] Could not record email outcome:', error)
    }
}
