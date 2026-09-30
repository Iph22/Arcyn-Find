/**
 * Did add_submission_screening.sql actually land?
 *
 * The submit route writes screening, screening_score and image_url. If the
 * migration has not run, every submission fails at insert. This asks the
 * database directly rather than trusting that it was applied.
 *
 * Read-only. Run with --env-file=.env.local
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

let missing = 0
for (const column of ['screening', 'screening_score', 'image_url', 'review_token', 'status', 'review_notes']) {
  const { error } = await db.from('tool_submissions').select(column).limit(1)
  const ok = !error
  if (!ok) missing++
  console.log(`  ${ok ? 'present' : 'MISSING'}  tool_submissions.${column}${ok ? '' : ' — ' + error.message}`)
}

console.log(
  missing === 0
    ? '\nMigration is applied. The submit route can write every column it needs.'
    : `\n${missing} column(s) missing — do NOT merge, submissions would fail at insert.`
)
process.exitCode = missing === 0 ? 0 : 1
