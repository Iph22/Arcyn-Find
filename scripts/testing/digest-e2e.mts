/**
 * Verify the notification digest before it is ever mailed to a real list.
 *
 *   npm run test:digest                      # dry run, sends nothing
 *   npm run test:digest -- --send=you@x.com  # also mails ONE real message
 *
 * Nothing here calls `sendDigest()`. That function reads the live recipient
 * table and mails everyone on it; there is no dry-run flag on it deliberately,
 * because a flag is a thing that can be wrong. This exercises the two parts
 * worth checking — what the digest would contain, and how it renders — against
 * the real database, and writes the rendered HTML to a file so it can be opened
 * in a browser and read before anyone receives it.
 *
 * Requires SUPABASE credentials, so it is not part of CI's default run:
 *
 *   npx tsx --env-file=.env.local scripts/testing/digest-e2e.mts
 */
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDigestContent, DIGEST_TOOL_COUNT } from '../../lib/notifications/digest-content.ts'
import { renderDigestHtml, renderDigestText } from '../../lib/notifications/template.ts'
import { isoWeekKey, claimRecipients, digestRunFailureReason } from '../../lib/notifications/send-digest.ts'
import { normalizeName } from '../../lib/seo/slug.ts'
import { getSupabaseAdmin } from '../../lib/supabase.ts'

const db = getSupabaseAdmin()

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const ORIGIN = 'https://arcynfind.com'

// ---------------------------------------------------------------------------
// 1. The period key
// ---------------------------------------------------------------------------
// This is the idempotency guard. If it is wrong at a year boundary, a run in
// early January either re-mails December's recipients or skips January's.

console.log('\nISO week key')
check('mid-year Thursday', isoWeekKey(new Date('2026-09-17T00:00:00Z')) === '2026-W38',
  isoWeekKey(new Date('2026-09-17T00:00:00Z')))
check('Jan 1 2026 (a Thursday) is W01', isoWeekKey(new Date('2026-01-01T00:00:00Z')) === '2026-W01',
  isoWeekKey(new Date('2026-01-01T00:00:00Z')))
// 2026 starts on a Thursday, so it is a 53-week ISO year and Jan 1 2027 (a
// Friday) still belongs to 2026-W53. Getting this wrong is the classic bug.
check('Jan 1 2027 belongs to 2026-W53', isoWeekKey(new Date('2027-01-01T00:00:00Z')) === '2026-W53',
  isoWeekKey(new Date('2027-01-01T00:00:00Z')))
check('Sunday resolves to its own week', isoWeekKey(new Date('2026-09-20T00:00:00Z')) === '2026-W38',
  isoWeekKey(new Date('2026-09-20T00:00:00Z')))
// A run that straddles midnight must not change key mid-flight for the same day.
check('key is stable across a day', isoWeekKey(new Date('2026-09-17T23:59:59Z')) === isoWeekKey(new Date('2026-09-17T00:00:01Z')))

// ---------------------------------------------------------------------------
// 2. Content selection, against the live corpus
// ---------------------------------------------------------------------------

console.log('\nContent selection')
const startedAt = Date.now()
const content = await buildDigestContent(null, ORIGIN)
const elapsed = Date.now() - startedAt

check('query is inside the cron budget', elapsed < 8_000, `${elapsed}ms`)
check('digest is not empty', content.tools.length > 0, `${content.tools.length} tools`)
check(`digest is full (${DIGEST_TOOL_COUNT})`, content.tools.length === DIGEST_TOOL_COUNT,
  `${content.tools.length} tools`)

// §1: 55% of the corpus is duplicate re-ingests. A digest that recommends
// tensorflow six times is the failure this guards.
const names = content.tools.map((t) => normalizeName(t.name))
check('no duplicate products', new Set(names).size === names.length, names.join(', '))

check('every tool has a slug', content.tools.every((t) => t.slug.length > 0))
check('every URL is absolute and on-site',
  content.tools.every((t) => t.url.startsWith(`${ORIGIN}/tools/`)))
check('no stub descriptions', content.tools.every((t) => t.description.length >= 40))
check('every tool has an image', content.tools.every((t) => Boolean(t.image)))

// The digest is a product recommendation, not a code search. Scraped repo rows
// were what made the old trending section unpresentable, and reusing the SEO
// layer's `isIndexable` here actively preferred them -- it demands >=25 words,
// which a README has and "AI-powered code editor..." does not. Guard the
// inversion, not just the symptom.
check('no repo rows in the digest',
  content.tools.every((t) => !/github\.com|gitlab\.com|huggingface\.co/i.test(t.url + ' ' + t.name)))

// Ranking by popularity alone clustered three writing tools and two code
// editors into one six-item digest.
const byCategory = new Map<string, number>()
for (const t of content.tools) {
  const k = (t.category || 'uncategorised').toLowerCase()
  byCategory.set(k, (byCategory.get(k) ?? 0) + 1)
}
check('no category dominates', [...byCategory.values()].every((n) => n <= 2),
  [...byCategory.entries()].map(([k, n]) => `${k}:${n}`).join(', '))

// Selection must be reproducible: popularity saturates at 100 across most of
// the band, so without an explicit tiebreak the same query returns different
// rows run to run (§3).
const repeat = await buildDigestContent(null, ORIGIN)
check('selection is deterministic',
  JSON.stringify(repeat.tools.map((t) => t.slug)) === JSON.stringify(content.tools.map((t) => t.slug)))

console.log('\n  Selected:')
for (const tool of content.tools) {
  console.log(`    - ${tool.name} (${tool.category || 'uncategorised'})`)
}

// The "new since" path. Passing a future timestamp should match nothing and
// fall back to best-of rather than returning an empty digest.
const future = new Date(Date.now() + 86_400_000).toISOString()
const fallback = await buildDigestContent(future, ORIGIN)
check('falls back when nothing is new', fallback.tools.length > 0 && fallback.isNew === false,
  `${fallback.tools.length} tools, isNew=${fallback.isNew}`)

// ---------------------------------------------------------------------------
// 3. Rendering
// ---------------------------------------------------------------------------

console.log('\nRendering')
const input = {
  tools: content.tools,
  isNew: content.isNew,
  displayName: 'Sam',
  unsubscribeUrl: `${ORIGIN}/api/notifications/unsubscribe?token=preview-token`,
  settingsUrl: `${ORIGIN}/settings`,
  siteUrl: ORIGIN,
}

const html = renderDigestHtml(input)
const text = renderDigestText(input)

check('html renders', html.length > 0, `${html.length} bytes`)
check('every tool appears in the html',
  content.tools.every((t) => html.includes(`/tools/${t.slug}`)))
check('unsubscribe link present in html', html.includes('unsubscribe?token='))
check('unsubscribe link present in text', text.includes('unsubscribe?token='))

// Tool names and descriptions are scraped third-party content going into a
// document we mail out. Nothing should survive as a live tag.
const bodyOnly = html.slice(html.indexOf('<body'))
check('no script tags in output', !/<script/i.test(bodyOnly))
check('no javascript: urls', !/javascript:/i.test(html))
check('no unresolved template holes', !html.includes('undefined') && !html.includes('[object Object]'))
check('text alternative is not empty', text.trim().length > 100, `${text.length} bytes`)

const previewPath = join(tmpdir(), 'arcyn-digest-preview.html')
writeFileSync(previewPath, html, 'utf8')
console.log(`\n  Preview written to: ${previewPath}`)

// ---------------------------------------------------------------------------
// 3b. Failure reporting
// ---------------------------------------------------------------------------
//
// The cron route must answer non-2xx when a run reached nobody, because the
// workflow's alert step fires on `curl --fail` and cannot fire on a success.
// Per-recipient rejections are counted rather than thrown, so a run where the
// provider refused every address previously returned 200 and went green.

console.log('\nFailure reporting')
const baseResult = {
  digestKey: '2026-W39', attempted: 0, sent: 0, failed: 0, skipped: 0,
  budgetExhausted: false, toolCount: 6, isNew: false, elapsedMs: 10,
}

check('healthy run is not a failure',
  digestRunFailureReason({ ...baseResult, attempted: 2, sent: 2 }) === null)

// The state right after the migration: content is fine, nobody has an address
// yet. Must NOT alert, or the schedule cries wolf every week until sign-ins
// accumulate.
check('zero recipients is not a failure',
  digestRunFailureReason(baseResult) === null)

// The configuration fault this fix exists for: unverified domain, revoked key.
check('every send failing IS a failure',
  digestRunFailureReason({ ...baseResult, attempted: 2, failed: 2 }) !== null,
  digestRunFailureReason({ ...baseResult, attempted: 2, failed: 2 }) ?? '')

// One bad address among several is tolerated -- addresses come from OAuth
// providers and are not re-validated, so some churn is expected.
check('partial failure is not escalated',
  digestRunFailureReason({ ...baseResult, attempted: 3, sent: 2, failed: 1 }) === null)

// An empty selection is never the catalog being quiet; the band holds ~2,900.
check('empty digest IS a failure',
  digestRunFailureReason({ ...baseResult, toolCount: 0 }) !== null,
  digestRunFailureReason({ ...baseResult, toolCount: 0 }) ?? '')

// ---------------------------------------------------------------------------
// 4. The idempotency guard
// ---------------------------------------------------------------------------
//
// The single thing standing between a retried cron run and mailing the whole
// list twice. It cannot be checked by reading the code: `ignoreDuplicates`
// degrades to an ordinary upsert if the unique index is missing, which looks
// identical at the call site and double-sends in production.
//
// Writes one sentinel row against a real profile and removes it in a `finally`,
// the same way view-tracking-e2e.mts does. Uses a TEST- prefixed key so it can
// never collide with a real ISO week.

console.log('\nIdempotency guard')
const sentinelKey = `TEST-${Date.now()}`
let sentinelUserId: string | null = null

try {
  const { data: anyProfile } = await db
    .from('user_profiles')
    .select('id, unsubscribe_token')
    .limit(1)
    .maybeSingle()

  if (!anyProfile) {
    check('a profile exists to test against', false, 'user_profiles is empty')
  } else {
    sentinelUserId = String(anyProfile.id)
    const recipient = {
      id: sentinelUserId,
      email: 'sentinel@example.invalid',
      displayName: null,
      unsubscribeToken: String(anyProfile.unsubscribe_token ?? 'sentinel'),
    }

    const first = await claimRecipients([recipient], sentinelKey)
    check('first claim reserves the recipient', first.has(sentinelUserId), `${first.size} claimed`)

    const second = await claimRecipients([recipient], sentinelKey)
    check('second claim reserves nobody', second.size === 0, `${second.size} claimed`)

    const { data: rows } = await db
      .from('notification_log')
      .select('id, status')
      .eq('kind', 'digest')
      .eq('digest_key', sentinelKey)
    check('exactly one log row exists', (rows?.length ?? 0) === 1, `${rows?.length ?? 0} rows`)
    check('row starts as claimed', rows?.[0]?.status === 'claimed', String(rows?.[0]?.status))
  }
} finally {
  if (sentinelUserId) {
    const { error } = await db.from('notification_log').delete().eq('digest_key', sentinelKey)
    check('sentinel row cleaned up', !error, error?.message ?? '')
  }
}

// ---------------------------------------------------------------------------
// 5. Who would actually receive this
// ---------------------------------------------------------------------------
//
// Reported rather than asserted. An empty recipient list is the expected state
// immediately after the migration -- addresses only accumulate as users sign in
// again, because `metadata.email` was never persisted before. Printing it stops
// "the digest reached nobody" from being mistaken for a broken sender.

const { data: recipients } = await db
  .from('user_profiles')
  .select('id, preferences')
  .not('email', 'is', null)
  .limit(1000)

const optedIn = (recipients ?? []).filter((r) => {
  const p = (r.preferences as Record<string, unknown> | null) ?? null
  if (!p) return true
  return p.email_notifications !== false && p.notify_digest !== false
})

console.log('\nRecipients')
console.log(`  profiles with an address: ${recipients?.length ?? 0}`)
console.log(`  of those, opted in      : ${optedIn.length}`)
if ((recipients?.length ?? 0) === 0) {
  console.log('  note: expected right after the migration — addresses fill in as users sign in.')
}

// ---------------------------------------------------------------------------
// 6. Optional: one real send
// ---------------------------------------------------------------------------

const sendArg = process.argv.find((a) => a.startsWith('--send='))
if (sendArg) {
  const to = sendArg.slice('--send='.length).trim()
  console.log(`\nSending one test message to ${to}`)

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    check('RESEND_API_KEY is set', false, 'cannot send without it')
  } else {
    // This must be byte-for-byte what the cron sends, or it is not a test of
    // the cron. The first version differed in two ways that both happened to
    // make it *less* deliverable than production: it omitted the
    // List-Unsubscribe headers, which are a strong legitimacy signal to Gmail,
    // and it prefixed the subject with "[test]", which is itself a mild spam
    // trigger. A message that lands in spam then tells you nothing about
    // whether the real digest would have.
    //
    // The unsubscribe token is the recipient's real one when they are a known
    // profile, so the link in the message genuinely works -- which also makes
    // this the only way the unsubscribe path gets exercised end to end.
    // Clicking it really does unsubscribe; re-enable under Settings.
    const { data: profile } = await db
      .from('user_profiles')
      .select('display_name, unsubscribe_token')
      .eq('email', to)
      .maybeSingle()

    const token = (profile?.unsubscribe_token as string | undefined) ?? 'preview-token'
    check('using the recipient\'s real unsubscribe token', token !== 'preview-token',
      profile ? `profile: ${profile.display_name}` : 'no matching profile; link will be inert')

    const unsubscribeUrl = `${ORIGIN}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`
    const realInput = { ...input, displayName: (profile?.display_name as string | undefined) ?? null, unsubscribeUrl }

    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: `Arcyn Find <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: [to],
      subject: content.isNew ? 'New AI tools on Arcyn Find' : 'AI tools worth a look',
      html: renderDigestHtml(realInput),
      text: renderDigestText(realInput),
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    check('test message accepted', !error && Boolean(data?.id), error?.message ?? data?.id ?? '')
  }
} else {
  console.log('\n  (no --send=<address> given; nothing was mailed)')
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}\n`)
process.exit(failures === 0 ? 0 : 1)
