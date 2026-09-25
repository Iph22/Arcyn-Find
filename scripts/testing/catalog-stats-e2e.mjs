#!/usr/bin/env node
/**
 * Verify catalog_stats_current() returns honest figures, fast enough to sit in
 * a page render.
 *
 * Run: npm run test:stats
 *
 * Requires supabase/migrations/add_catalog_stats.sql to be applied.
 *
 * Context: the landing page advertised "7K+ AI Tools" as a hard-coded fallback
 * and rendered the ROW count (272,755) when the live figure loaded, while the
 * public directory could only show 2,913 and Google was quoting "Over 25,000".
 * This asserts the number the site states is the number the data supports.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing env. Run: npm run test:stats')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

/**
 * The read path runs inside a page render, so it has to be quick.
 *
 * Overridable because this figure is round-trip time, not query time, and the
 * two are not separable from here. The same call measured 400ms and 1639ms on
 * one machine minutes apart -- straddling this budget -- and a GitHub runner
 * reaches Supabase over a different network again. Left as a hard 1500 it makes
 * the suite flaky, and a merge gate that fails at random is one people learn to
 * ignore, which is the habit `continue-on-error` already cost this project.
 *
 * CI sets a looser value. That still catches the regression this guards -- a
 * cached read collapsing into a full recompute, which costs seconds, not
 * milliseconds. A tighter figure belongs in a performance check that can
 * re-measure, not in a gate that has to be right first time.
 */
const CACHED_BUDGET_MS = Number(process.env.CATALOG_STATS_CACHED_BUDGET_MS) || 1500
/** The recompute is a full scan of ~272k rows; the statement timeout is 8-9s. */
const RECOMPUTE_BUDGET_MS = 8000

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}   ${label}${detail ? '  (' + detail + ')' : ''}`)
  if (!ok) failures++
}

async function call(maxAge) {
  const started = Date.now()
  const args = maxAge === undefined ? {} : { p_max_age: maxAge }
  const { data, error } = await db.rpc('catalog_stats_current', args)
  const ms = Date.now() - started
  if (error) {
    if (error.message?.includes('Could not find the function')) {
      console.error(
        '\ncatalog_stats_current() does not exist.\n' +
          'Apply supabase/migrations/add_catalog_stats.sql in the Supabase SQL editor.\n'
      )
      process.exit(1)
    }
    throw new Error(`${error.message} (after ${ms}ms)`)
  }
  return { ms, row: Array.isArray(data) ? data[0] : data }
}

console.log('catalog_stats_current — end to end\n')

// 1. Cached read: what every page render pays.
const cached = await call()
console.log(
  `cached read: ${cached.ms}ms  distinct=${cached.row?.distinct_products} ` +
    `published=${cached.row?.published} categories=${cached.row?.categories} ` +
    `rows=${cached.row?.total_rows}`
)
check('cached read is page-render fast', cached.ms < CACHED_BUDGET_MS, `${cached.ms}ms`)

// 2. The figures have to be internally consistent, or we are back to
//    advertising something the site cannot show.
const d = Number(cached.row?.distinct_products) || 0
const p = Number(cached.row?.published) || 0
const t = Number(cached.row?.total_rows) || 0
const c = Number(cached.row?.categories) || 0

check('distinct products > 0', d > 0, String(d))
check('distinct products <= total rows', d <= t, `${d} <= ${t}`)
check('published <= distinct products', p <= d, `${p} <= ${d}`)
check('published > 0', p > 0, String(p))
check('categories > 0', c > 0, String(c))
// This assertion used to read `d < t * 0.5` -- distinct had to sit well below
// the row count, which proved the figure was not a naive `count(*)` back when
// 94.4% of the table was duplicate re-ingests.
//
// The de-duplication (2026-09-21) made that premise false: 15,250 distinct
// names in 15,252 rows. The old check now fails precisely because the fix
// worked, so it was reporting a success as a regression.
//
// Inverted to guard what matters now. AGENTS.md records that the duplication
// "rebuilds itself silently if that guard is removed", and nothing else here
// would notice -- search hides duplicates behind DISTINCT ON at query time.
// A drop below 90% distinct means the ingest guard has regressed.
check(
  'duplicates have not come back (distinct is close to the row count)',
  d >= t * 0.9,
  `${d} distinct of ${t} rows — ${((d / t) * 100).toFixed(1)}% distinct`
)

// 3. Forced recompute: the once-a-day path must fit the statement timeout.
console.log('\nforcing a recompute (full scan)')
const fresh = await call('0 seconds')
console.log(`recompute: ${fresh.ms}ms  distinct=${fresh.row?.distinct_products}`)
check('recompute fits the statement timeout', fresh.ms < RECOMPUTE_BUDGET_MS, `${fresh.ms}ms`)
check(
  'recompute agrees with the cached value',
  Number(fresh.row?.distinct_products) === d,
  `${fresh.row?.distinct_products} vs ${d}`
)

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
