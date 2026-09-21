/**
 * Exercises the contact/feedback storage path against the real database.
 *
 *   npm run test:contact
 *
 * Sends NO email. It drives the same `storeSubmission` / `recordEmailOutcome`
 * the route uses, so the payload under test cannot drift from the payload in
 * production, and then deletes its rows in a `finally`.
 *
 * What it is really checking is that add_contact_submissions.sql has been
 * applied. Without the table the route degrades quietly — it logs, returns 200
 * and falls back to email-only, which is exactly the silent behaviour that
 * lost a beta report on 2026-09-21. A missing migration should be one command
 * away from being obvious, not something you discover months later.
 */
import {
    storeSubmission,
    recordEmailOutcome,
    sourceFor,
    hashIP,
    FEEDBACK_SUBJECT_PREFIX,
} from '../../lib/services/contact.service.ts'
import { sanitizeHtml, unescapeHtml } from '../../lib/security/input-validator.ts'
import { getSupabaseAdmin } from '../../lib/supabase.ts'

const supabase = getSupabaseAdmin()

let failures = 0
function check(name: string, ok: boolean, detail = '') {
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
    if (!ok) failures++
}

const marker = `e2e-${Math.random().toString(16).slice(2, 10)}`
const testEmail = `${marker}@example.invalid`
const testIp = '203.0.113.9'

// Pure functions first: no database needed, and they define the row shape.
check('feedback subjects are classed as feedback_widget', sourceFor(`${FEEDBACK_SUBJECT_PREFIX} /tools`) === 'feedback_widget')
check('other subjects are classed as contact_form', sourceFor('Partnership enquiry') === 'contact_form')
check('hashIP is a 16-char digest that is not the input', hashIP(testIp).length === 16 && hashIP(testIp) !== testIp)

// Escaping. safeString escapes at the input boundary, so everything
// downstream of validation has to undo it before storing or writing plain
// text. Getting this wrong showed literal `&#x2F;` in every delivered email.
const slashy = 'Page: /tools/example?a=1 & "quoted"'
check('unescapeHtml inverts sanitizeHtml', unescapeHtml(sanitizeHtml(slashy)) === slashy, unescapeHtml(sanitizeHtml(slashy)))
check(
    'a double escape unwinds exactly one level',
    unescapeHtml(sanitizeHtml(sanitizeHtml('/'))) === sanitizeHtml('/'),
    unescapeHtml(sanitizeHtml(sanitizeHtml('/')))
)
check('a literal ampersand survives the round trip', unescapeHtml(sanitizeHtml('Tom & Jerry')) === 'Tom & Jerry')

let storedId: string | null = null

try {
    storedId = await storeSubmission({
        name: 'E2E Runner',
        email: testEmail,
        subject: `${FEEDBACK_SUBJECT_PREFIX} /tools/example`,
        // Slash-heavy on purpose: this mirrors the page/URL/user-agent block
        // the feedback widget appends, which is where the escaping showed.
        message: 'Storage check.\n\n---\nPage: /tools/example\nURL: https://arcynfind.com/tools/example',
        ip: testIp,
    })

    check(
        'storeSubmission returned an id (table exists and accepts the payload)',
        !!storedId,
        storedId ? String(storedId) : 'null — has add_contact_submissions.sql been applied?'
    )

    if (storedId) {
        const { data: row } = await supabase
            .from('contact_submissions')
            .select('name, email, subject, message, source, email_status, email_id, ip_hash, created_at')
            .eq('id', storedId)
            .single()

        check('the row is readable back', !!row)
        check('source was derived from the subject prefix', row?.source === 'feedback_widget', String(row?.source))
        check('email_status defaults to pending', row?.email_status === 'pending', String(row?.email_status))
        check('the raw IP was not stored', row?.ip_hash !== testIp && !!row?.ip_hash, String(row?.ip_hash))
        check('ip_hash matches hashIP', row?.ip_hash === hashIP(testIp))
        check('created_at was set', !!row?.created_at)
        check(
            'the stored message holds real slashes, not entities',
            !!row?.message.includes('https://arcynfind.com/tools/example') && !row.message.includes('&#x2F;'),
            JSON.stringify(row?.message?.slice(-45))
        )

        // The annotation step: a delivery failure must be recorded against the
        // row rather than lost, since that is the whole point of the table.
        await recordEmailOutcome(storedId, {
            status: 'failed',
            error: 'e2e simulated provider error',
        })

        const { data: annotated } = await supabase
            .from('contact_submissions')
            .select('email_status, email_error')
            .eq('id', storedId)
            .single()

        check('a failed send is recorded', annotated?.email_status === 'failed', String(annotated?.email_status))
        check('the provider error is kept', annotated?.email_error === 'e2e simulated provider error')

        await recordEmailOutcome(storedId, { status: 'sent', id: 'e2e-fake-message-id' })
        const { data: sent } = await supabase
            .from('contact_submissions')
            .select('email_status, email_id, email_error')
            .eq('id', storedId)
            .single()
        check('a later success overwrites the failure', sent?.email_status === 'sent', String(sent?.email_status))
        check('the message id is kept', sent?.email_id === 'e2e-fake-message-id')
        check('the stale error is cleared', sent?.email_error === null, String(sent?.email_error))

        // The CHECK constraint is what stops a typo becoming an unqueryable
        // status, so confirm it actually rejects one.
        const { error: badStatus } = await supabase
            .from('contact_submissions')
            .update({ email_status: 'definitely-not-a-status' })
            .eq('id', storedId)
        check('the email_status CHECK constraint rejects unknown values', !!badStatus, badStatus?.code ?? 'no error raised')
    }
} finally {
    const { error: cleanupError } = await supabase
        .from('contact_submissions')
        .delete()
        .eq('email', testEmail)

    const { count: leftover } = await supabase
        .from('contact_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('email', testEmail)

    check(
        'test rows removed',
        !cleanupError && leftover === 0,
        cleanupError ? cleanupError.message : `${leftover} left`
    )
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
