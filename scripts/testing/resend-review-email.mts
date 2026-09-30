/**
 * Re-send the reviewer email for a submission that is still pending.
 *
 * For when the submission stored correctly but the notification did not
 * arrive -- a misconfigured sender, a bounce, a deleted message. It creates
 * nothing and changes nothing: the row and its review token are untouched, so
 * the link in the new message is the same one the original carried.
 *
 * The origin is given rather than derived, because this runs from a terminal
 * and has no request to read it from. Point it at wherever the reviewer should
 * land -- the preview host while testing, production once live.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/testing/resend-review-email.mts \
 *     --origin=https://preview.arcynfind.com [--name="Tool name"]
 */

import { createClient } from '@supabase/supabase-js'

import { renderReviewEmail, sendMail } from '../../lib/notifications/submission-emails'
import type { Screening } from '../../lib/submission-screening'

const arg = (flag: string) => process.argv.find((a) => a.startsWith(`--${flag}=`))?.slice(flag.length + 3)

const origin = (arg('origin') || 'https://preview.arcynfind.com').replace(/\/+$/, '')
const onlyName = arg('name')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}

const reviewTo = process.env.SUBMISSION_REVIEW_EMAIL || process.env.RESEND_FROM_EMAIL
if (!reviewTo) {
  console.error('Neither SUBMISSION_REVIEW_EMAIL nor RESEND_FROM_EMAIL is set — nowhere to send it.')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

let query = db
  .from('tool_submissions')
  .select('id, name, description, url, category, submitted_by, image_url, screening, review_token')
  .eq('status', 'pending')
  .not('review_token', 'is', null)
  .order('submitted_at', { ascending: false })

if (onlyName) query = query.eq('name', onlyName)

const { data, error } = await query.limit(10)
if (error) {
  console.error(error.message)
  process.exit(1)
}
if (!data?.length) {
  console.log('Nothing pending with a live review token.')
  process.exit(0)
}

console.log(`Sending to ${reviewTo}, links pointing at ${origin}\n`)

let failed = 0
for (const row of data) {
  const message = renderReviewEmail({
    submission: {
      name: row.name,
      description: row.description,
      url: row.url,
      category: row.category,
      submittedBy: row.submitted_by,
      imageUrl: row.image_url,
    },
    screening: row.screening as Screening | null,
    reviewUrl: `${origin}/review/${row.review_token}`,
  })

  const result = await sendMail(reviewTo, message)
  console.log(`  ${result.sent ? 'sent  ' : 'FAILED'} ${row.name}${result.sent ? '' : ` — ${result.reason}`}`)
  if (result.sent) console.log(`         ${origin}/review/${row.review_token}`)
  if (!result.sent) failed++
}

process.exitCode = failed === 0 ? 0 : 1
