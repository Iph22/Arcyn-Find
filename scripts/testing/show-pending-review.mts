/**
 * What is waiting for review, and what does its link look like?
 *
 * For checking a submission by hand without digging through the dashboard.
 * Prints the review URL, so the flow can be walked through in a browser when
 * the email has not arrived or is not the thing being tested.
 *
 * Read-only. Run with --env-file=.env.local [baseUrl]
 */

import { createClient } from '@supabase/supabase-js'

const BASE = process.argv[2] || 'http://localhost:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const { data, error } = await db
  .from('tool_submissions')
  .select('id, name, url, status, screening_score, screening, review_token, submitted_by, submitted_at, image_url')
  .eq('status', 'pending')
  .order('submitted_at', { ascending: false })
  .limit(10)

if (error) {
  console.error(error.message)
  process.exit(1)
}

if (!data?.length) {
  console.log('Nothing pending.')
  process.exit(0)
}

for (const row of data) {
  console.log(`\n${row.name}   ${row.screening_score ?? '—'}/100`)
  console.log(`  ${row.url}`)
  console.log(`  from ${row.submitted_by ?? '(no email)'}   ${row.submitted_at}`)
  if (row.image_url) console.log(`  image: ${row.image_url}`)

  const screening = row.screening as { checks?: { status: string; label: string; detail: string }[]; blocking?: string[] } | null
  for (const b of screening?.blocking ?? []) console.log(`  BLOCKING: ${b}`)
  for (const c of screening?.checks ?? []) {
    const glyph = c.status === 'pass' ? '+' : c.status === 'fail' ? '-' : '?'
    console.log(`    ${glyph} ${c.label} — ${c.detail}`)
  }

  console.log(`  review: ${BASE}/review/${row.review_token}`)
}
