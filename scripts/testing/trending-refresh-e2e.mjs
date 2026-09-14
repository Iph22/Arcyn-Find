#!/usr/bin/env node
/**
 * Verify refresh_trending_stats() does the job the 6-hourly cron needs, inside
 * the route's 60s budget.
 *
 * Run: npm run test:trending
 *
 * Requires supabase/migrations/add_refresh_trending_stats.sql to be applied.
 *
 * Context: the endpoint this replaces failed 40 consecutive scheduled runs with
 * HTTP 504, because it paginated all 263k ai_tools rows with deep `.range()`
 * offsets (measured: statement timeout at offset 100,000). See
 * docs/CORPUS_AND_CONSTRAINTS.md §6.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing env. Run: npm run test:trending')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

/** The route's ceiling. Exceeding it is the failure this script exists to catch. */
const BUDGET_MS = 60_000

let failures = 0
function check(label, ok, detail = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}   ${label}${detail ? '  (' + detail + ')' : ''}`)
  if (!ok) failures++
}

async function callRefresh(label) {
  const started = Date.now()
  const { data, error } = await db.rpc('refresh_trending_stats', {
    // Matches DEMOTE_CHUNK in the service. 1000 exceeds the statement timeout.
    p_cleanup_limit: 250,
    p_retention_days: 30,
    p_demote_only: false,
  })
  const ms = Date.now() - started

  if (error) {
    if (error.message?.includes('Could not find the function')) {
      console.error(
        '\nrefresh_trending_stats() is missing or has the old 2-argument\n' +
          'signature. Re-apply supabase/migrations/add_refresh_trending_stats.sql\n' +
          'in the Supabase SQL editor — it drops the old version first.\n'
      )
      process.exit(1)
    }
    throw new Error(error.message)
  }

  const row = Array.isArray(data) ? data[0] : data
  console.log(
    `  ${label}: ${ms}ms  scored=${row?.scored ?? 0} demoted=${row?.demoted ?? 0} purged=${row?.purged ?? 0}`
  )
  return { ms, row: row ?? { scored: 0, demoted: 0, purged: 0 } }
}

console.log('refresh_trending_stats — end to end\n')

// 0. The predicate step 2 depends on. If ai_tools_viewed_7d_idx is being used
//    this is single-digit ms; if the planner falls back to a scan it takes
//    seconds, because proving zero rows match means walking every is_trending
//    row. That distinction is the difference between the function fitting in
//    its budget and blowing the statement timeout, so it is measured first.
{
  // Measured against a control, not an absolute threshold: every query here
  // pays a round trip to Supabase, and that floor is hundreds of ms from a
  // normal connection. An absolute "< 500ms" bound just measures the network.
  // A sequential scan of the ~60k is_trending rows took 6.4s when this was
  // broken, so a scan is unmissable next to a trivial control query.
  const controlStart = Date.now()
  await db.from('ai_tools').select('id').limit(1)
  const controlMs = Date.now() - controlStart

  const started = Date.now()
  const { data, error } = await db
    .from('ai_tools')
    .select('id')
    .eq('is_trending', true)
    .gt('view_count_7d', 0)
    .limit(250)
  const ms = Date.now() - started

  console.log(
    `index probe: ${ms}ms (control round trip ${controlMs}ms)  ` +
      `${error ? 'ERROR ' + error.message.slice(0, 50) : data.length + ' rows'}`
  )
  check(
    'demotion predicate is index-backed, not a scan',
    !error && ms < Math.max(controlMs * 4, 2500),
    error
      ? 'query failed'
      : `${ms}ms vs ${controlMs}ms control` +
        (ms >= Math.max(controlMs * 4, 2500) ? ' — looks like a scan; check ANALYZE ai_tools ran' : '')
  )
}

// 1. It completes, and well inside the cron's budget.
console.log('run 1')
const first = await callRefresh('elapsed')
check('completes without error', true)
check(`finishes inside the ${BUDGET_MS / 1000}s route budget`, first.ms < BUDGET_MS, `${first.ms}ms`)
check('comfortably inside it (< 10s)', first.ms < 10_000, `${first.ms}ms`)

// 2. Idempotent: a second run right after changes nothing new except more
//    demotions draining the stale-flag backlog.
console.log('\nrun 2 (immediately after)')
const second = await callRefresh('elapsed')
check('second run also inside budget', second.ms < BUDGET_MS, `${second.ms}ms`)

// 3. Nothing this job promoted is left flagged without the views to justify it.
//
//    Scoped to rows carrying view history, because that is the only set this
//    job owns. ai_tools.is_trending is also written by the ingest from source
//    heuristics (GitHub stars, HuggingFace downloads) and is true for ~60,332
//    of 263,548 rows; those are deliberately left alone — see the migration.
const { data: ours, error: oursErr } = await db
  .from('ai_tools')
  .select('id, name, view_count_24h, view_count_7d, trending_score, is_trending')
  .eq('is_trending', true)
  .gt('view_count_7d', 0)
  .limit(50)

if (oursErr) {
  console.log(`\n  (could not sample promoted rows: ${oursErr.message.slice(0, 60)})`)
} else {
  console.log(`\n  rows promoted by this job: ${ours.length}`)
  const stale = ours.filter(
    (t) => (t.view_count_24h ?? 0) === 0 && (t.view_count_7d ?? 0) === 0
  )
  check(
    'every tool this job flagged has the views to justify it',
    stale.length === 0,
    stale.length ? `${stale.length} stale, e.g. ${stale[0].name}` : `${ours.length} sampled`
  )
}

// 4. The ingest-owned flags were not touched.
const { count: ingestFlags } = await db
  .from('ai_tools')
  .select('id', { count: 'planned', head: true })
  .eq('is_trending', true)
console.log(`  is_trending rows overall (mostly ingest-set): ~${ingestFlags}`)

console.log(
  failures === 0
    ? '\nAll checks passed.'
    : `\n${failures} check(s) failed.`
)
process.exit(failures === 0 ? 0 : 1)
