#!/usr/bin/env node
/**
 * Verify the ingest can now tell what the catalog already contains.
 *
 * Run: npm run test:dedup
 *
 * Requires supabase/migrations/add_normalized_name.sql.
 *
 * WHAT BROKE, AND WHAT THIS PROVES IS FIXED
 *
 * The old existence check was
 *
 *     .select('name').in('name', <50 names>).limit(50)
 *
 * which capped the answer at 50 ROWS while one name could occupy hundreds --
 * 'AgenticX' had 665. The slots filled with copies of one name, every other
 * name came back "not found", and all were re-inserted. Self-reinforcing:
 * 273,187 rows holding 15,218 products, +432 rows for +8 tools over two days.
 *
 * The assertions below are the properties that failure violated: a heavily
 * duplicated name must still be reported as existing, and the answer must not
 * truncate.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing env. Run: npm run test:dedup')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

/** The lookup runs inside an hourly cron; it has to be quick. */
const LOOKUP_BUDGET_MS = 3000
/** The recompute previously exceeded the 8-9s statement timeout. */
const RECOMPUTE_BUDGET_MS = 8000

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}   ${label}${detail ? '  (' + detail + ')' : ''}`)
  if (!ok) failures++
}

const normalize = (name) =>
  (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

console.log('ingest de-duplication — end to end\n')

// 0. The column has to exist before anything else means much.
{
  const { error } = await db.from('ai_tools').select('normalized_name').limit(1)
  if (error) {
    console.error(
      '\nnormalized_name does not exist.\n' +
        'Apply supabase/migrations/add_normalized_name.sql in the Supabase SQL editor.\n'
    )
    process.exit(1)
  }
  check('normalized_name column exists', true)
}

// 1. It must agree with the JS. If these drift, the ingest stops recognising
//    what the database holds and duplicates resume.
{
  const { data } = await db
    .from('ai_tools')
    .select('name, normalized_name')
    .not('name', 'is', null)
    .limit(200)
  const mismatched = (data ?? []).filter((r) => normalize(r.name) !== r.normalized_name)
  check(
    'column matches the JS normalisation',
    mismatched.length === 0,
    mismatched.length
      ? `${mismatched.length}/${data.length} differ, e.g. "${mismatched[0].name}"`
      : `${data?.length ?? 0} sampled`
  )
}

// 2. Find the most duplicated product available, and confirm the lookup still
//    reports it. This is the exact case the old check got wrong.
{
  const { data } = await db
    .from('ai_tools')
    .select('normalized_name')
    .not('normalized_name', 'is', null)
    .limit(1000)
  const counts = new Map()
  for (const r of data ?? []) counts.set(r.normalized_name, (counts.get(r.normalized_name) || 0) + 1)
  const [worst, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]

  if (!worst) {
    check('found a duplicated product to test with', false, 'none in sample')
  } else {
    const started = Date.now()
    const { data: found, error } = await db.rpc('existing_tool_names', { p_names: [worst] })
    const ms = Date.now() - started
    const names = (found ?? []).map((r) => r.normalized_name)

    console.log(`  using "${worst}" (${n}+ rows in sample)`)
    check('lookup succeeds', !error, error?.message ?? '')
    check('a heavily duplicated product IS reported as existing', names.includes(worst))
    check('result is DISTINCT — one row per name, not one per row', names.length === 1, `${names.length} rows`)
    check(`lookup is fast (< ${LOOKUP_BUDGET_MS}ms)`, ms < LOOKUP_BUDGET_MS, `${ms}ms`)
  }
}

// 3. A name that does not exist must come back absent, or nothing new is ever
//    inserted again.
{
  const { data: found, error } = await db.rpc('existing_tool_names', {
    p_names: ['zzz definitely not a real tool 4f2a'],
  })
  check('an unknown product is reported as absent', !error && (found ?? []).length === 0)
}

// 4. A realistic batch must not truncate. PostgREST caps responses at 1000
//    rows; DISTINCT is what keeps this bounded by input size instead.
{
  const { data } = await db
    .from('ai_tools')
    .select('normalized_name')
    .not('normalized_name', 'is', null)
    .limit(1000)
  const batch = [...new Set((data ?? []).map((r) => r.normalized_name))].slice(0, 200)
  const started = Date.now()
  const { data: found, error } = await db.rpc('existing_tool_names', { p_names: batch })
  const ms = Date.now() - started
  check(
    'a 200-name batch returns every one, without truncating',
    !error && (found ?? []).length === batch.length,
    `asked ${batch.length}, got ${(found ?? []).length} in ${ms}ms`
  )
}

// 5. The stats recompute has to fit the statement timeout again.
{
  const started = Date.now()
  const { data, error } = await db.rpc('catalog_stats_current', { p_max_age: '0 seconds' })
  const ms = Date.now() - started
  const row = Array.isArray(data) ? data[0] : data
  check(
    `catalog recompute fits the statement timeout (< ${RECOMPUTE_BUDGET_MS}ms)`,
    !error && ms < RECOMPUTE_BUDGET_MS,
    error ? error.message : `${ms}ms`
  )
  if (row) {
    const rows = Number(row.total_rows)
    const prod = Number(row.distinct_products)
    console.log(
      `\n  catalog: ${prod.toLocaleString()} products across ${rows.toLocaleString()} rows ` +
        `(${(((rows - prod) / rows) * 100).toFixed(1)}% duplicate)`
    )
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
