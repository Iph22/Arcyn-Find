/**
 * What does an ai_tools insert actually require?
 *
 * Approving a submission failed on a NOT NULL `status` column that nothing in
 * the codebase writes. This reads a real row to see which columns exist and
 * what values live in them, so the insert is built from what the table wants
 * rather than from what an adjacent insert happened to set.
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

// Never select('*') on this table -- it carries a 768-float embedding column.
const { data, error } = await db
  .from('ai_tools')
  .select('id, name, status, popularity, region, access_type, pricing, is_trending, last_updated')
  .not('slug', 'is', null)
  .limit(3)

if (error) {
  console.error('query failed:', error.message)
  process.exit(1)
}

console.log('Sample of published rows:\n')
for (const row of data ?? []) {
  console.log(`  ${row.name}`)
  for (const [k, v] of Object.entries(row)) {
    if (k === 'name') continue
    console.log(`      ${k.padEnd(14)} ${JSON.stringify(v)}`)
  }
  console.log()
}

// What distinct values does status take? If it is an enum-by-convention, the
// insert has to pick one that means "live".
const seen = new Set((data ?? []).map((r) => r.status))
console.log('distinct status values in this sample:', JSON.stringify([...seen]))
