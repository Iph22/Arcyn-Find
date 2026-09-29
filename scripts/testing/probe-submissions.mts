/**
 * Is the submission queue real, and has anything bypassed it?
 *
 * app/api/tools/submit/route.ts has a fallback: if inserting into
 * tool_submissions fails with a message containing "does not exist", it
 * inserts straight into ai_tools and answers "Tool submitted and added
 * directly!". That publishes unreviewed, user-supplied content to the live
 * catalog on an error path, which is the opposite of a review queue.
 *
 * This asks two things: does the table exist (so the fallback is dormant), and
 * did anything ever go through it.
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

const { count, error } = await db
  .from('tool_submissions')
  .select('*', { count: 'exact', head: true })

console.log(
  error
    ? `tool_submissions: ERROR — ${error.message}`
    : `tool_submissions exists, ${count} row(s)`
)

if (!error) {
  const { data } = await db
    .from('tool_submissions')
    .select('name, status, submitted_at')
    .order('submitted_at', { ascending: false })
    .limit(10)
  for (const row of data ?? []) {
    console.log(`  ${String(row.status).padEnd(9)} ${row.name}  ${row.submitted_at}`)
  }
}

// Rows the bypass would have created. Bounded and ordered so it cannot become
// the full-table walk that docs/CORPUS_AND_CONSTRAINTS warns about.
const { data: bypassed, error: bypassError } = await db
  .from('ai_tools')
  .select('id, name, platform')
  .gte('id', 'submitted-')
  .lt('id', 'submitted.')
  .limit(20)

console.log(
  bypassError
    ? `\nbypass check: ERROR — ${bypassError.message}`
    : `\nrows in ai_tools from the direct-insert bypass: ${(bypassed ?? []).length}`
)
for (const row of bypassed ?? []) console.log(`  ${row.name} — ${row.platform}`)
