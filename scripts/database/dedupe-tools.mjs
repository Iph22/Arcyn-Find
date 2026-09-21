#!/usr/bin/env node
/**
 * Remove duplicate re-ingests, keeping one row per product.
 *
 *   npm run dedupe:dry        report only, touches nothing   (default)
 *   npm run dedupe            delete, in paced batches
 *
 * ALREADY RUN. On 2026-09-21 this deleted 257,956 rows, 0 failures, taking
 * ai_tools from 273,175 rows to 15,219 for 15,218 distinct products. All 2,913
 * published pages survived, verified by slug afterwards. It is kept because it
 * is the record of what was removed and why, and because it is re-runnable: on
 * a clean catalog the dry run reports nothing to delete.
 *
 * The rows were the same tools re-inserted by an ingest that could not tell
 * what it already had -- a `.limit(50)` on a lookup keyed by name, where one
 * name ('AgenticX') occupied 665 rows. Fixed in lib/auto-update.ts, which now
 * goes through the existing_tool_names RPC; this cleared the backlog that bug
 * had already built. Apply supabase/migrations/add_normalized_name.sql first
 * or the ingest will simply rebuild it.
 *
 * WHAT IS PROTECTED, AND WHY
 *
 * A row is kept if ANY of these hold. They are checked before anything is
 * deleted, not assumed:
 *
 *   slug          the public page at /tools/<slug> resolves through it, and
 *                 deleting it 404s a URL Google has indexed
 *   referenced    a favourite, review, view, collection entry or submission
 *                 points at that exact id -- deleting it orphans user data
 *   embedding     semantic search needs it, and regenerating costs Gemini
 *                 quota capped at 1,000/day (docs/CORPUS_AND_CONSTRAINTS.md §4)
 *
 * Of whatever remains in a group, the survivor is the richest row: most
 * popularity, then longest description, then oldest -- so the choice is
 * deterministic and re-running changes nothing.
 *
 * DELETION IS PACED ON PURPOSE. §2 measured writes against this table as
 * superlinear: 500 rows took 2.1s and 1,000 exceeded the statement timeout,
 * because every write maintains every index including IVFFlat. Small batches
 * with a pause between them; `VACUUM ANALYZE ai_tools;` afterwards -- that
 * vacuum is not optional, the post-delete bloat timed out a full-table walk
 * until it ran.
 */

import { createClient } from '@supabase/supabase-js'

const EXECUTE = process.argv.includes('--execute')
const DELETE_BATCH = 200
const PAUSE_MS = 150
const PAGE = 1000

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing env. Run: npm run dedupe:dry')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Same rule as ai_tools.normalized_name and normalizeName() in lib/seo/slug.ts. */
const normalize = (name) =>
  (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Every tool id referenced from anywhere else. These can never be deleted. */
async function loadReferencedIds() {
  const pinned = new Set()
  const sources = [
    ['tool_views', 'tool_id'],
    ['user_favorites', 'tool_id'],
    ['tool_reviews', 'tool_id'],
    ['collection_items', 'tool_id'],
    ['recommendation_feedback', 'tool_id'],
  ]

  for (const [table, col] of sources) {
    let cursor = 0
    for (let page = 0; page < 20; page++) {
      const { data, error } = await db
        .from(table)
        .select(col)
        .range(cursor, cursor + PAGE - 1)
      if (error) break // table absent in this deployment; nothing to protect
      for (const row of data) if (row[col]) pinned.add(row[col])
      if (data.length < PAGE) break
      cursor += PAGE
    }
  }
  return pinned
}

/** Walk the whole table, grouping rows by product. */
async function loadGroups() {
  const groups = new Map()
  let cursor = null
  let rows = 0
  const started = Date.now()

  for (let page = 0; page < 400; page++) {
    let q = db
      .from('ai_tools')
      .select('id, name, slug, popularity, description, created_at, embedding_is_set:embedding')
      .order('id', { ascending: true })
      .limit(PAGE)
    if (cursor) q = q.gt('id', cursor)

    let { data, error } = await q
    if (error) {
      // `embedding` is a 768-float column and must never be selected (§2). If
      // the alias trick is rejected, fall back to the columns that matter.
      const retry = await (cursor
        ? db.from('ai_tools').select('id, name, slug, popularity, description, created_at').order('id', { ascending: true }).limit(PAGE).gt('id', cursor)
        : db.from('ai_tools').select('id, name, slug, popularity, description, created_at').order('id', { ascending: true }).limit(PAGE))
      if (retry.error) throw new Error(retry.error.message)
      data = retry.data
    }
    if (!data.length) break

    for (const r of data) {
      const key = normalize(r.name)
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(r)
    }

    rows += data.length
    cursor = data[data.length - 1].id
    if (page % 50 === 0) {
      process.stdout.write(`  ...${rows.toLocaleString()} rows, ${groups.size.toLocaleString()} products (${Math.round((Date.now() - started) / 1000)}s)\n`)
    }
    if (data.length < PAGE) break
  }

  return { groups, rows }
}

/** Richest row wins: popularity, then description length, then oldest. */
function best(rows) {
  return [...rows].sort(
    (a, b) =>
      (b.popularity || 0) - (a.popularity || 0) ||
      (b.description || '').length - (a.description || '').length ||
      String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
      String(a.id).localeCompare(String(b.id))
  )[0]
}

async function main() {
  console.log(EXECUTE ? 'DEDUPE — EXECUTING\n' : 'DEDUPE — DRY RUN (nothing will be deleted)\n')

  const pinned = await loadReferencedIds()
  console.log(`Protected by references from other tables: ${pinned.size} tool ids\n`)

  const { groups, rows } = await loadGroups()

  const deleteIds = []
  let keptSlug = 0
  let keptPinned = 0
  let keptBest = 0
  let untouched = 0

  for (const [, members] of groups) {
    if (members.length === 1) {
      untouched++
      continue
    }
    const keep = new Set()
    for (const r of members) {
      if (r.slug) { keep.add(r.id); keptSlug++ }
      else if (pinned.has(r.id)) { keep.add(r.id); keptPinned++ }
    }
    if (keep.size === 0) {
      keep.add(best(members).id)
      keptBest++
    }
    for (const r of members) if (!keep.has(r.id)) deleteIds.push(r.id)
  }

  const survivors = rows - deleteIds.length
  console.log('\n================ PLAN ================')
  console.log(`  rows now                 ${rows.toLocaleString()}`)
  console.log(`  distinct products        ${groups.size.toLocaleString()}`)
  console.log(`  products already single  ${untouched.toLocaleString()}`)
  console.log(`  kept for a public page   ${keptSlug.toLocaleString()}`)
  console.log(`  kept — referenced        ${keptPinned.toLocaleString()}`)
  console.log(`  kept — richest of group  ${keptBest.toLocaleString()}`)
  console.log(`  TO DELETE                ${deleteIds.length.toLocaleString()}`)
  console.log(`  rows after               ${survivors.toLocaleString()}`)

  // Refuse to proceed on anything that looks wrong, rather than trusting the
  // arithmetic above. A bug here deletes a production catalog.
  const problems = []
  if (survivors < groups.size) problems.push(`would leave ${survivors} rows for ${groups.size} products`)
  if (deleteIds.length > rows * 0.99) problems.push('would delete more than 99% of the table')
  if (deleteIds.some((id) => pinned.has(id))) problems.push('a referenced id is in the delete set')
  // The strongest guarantee of the three: a slug is a URL Google has indexed,
  // so deleting one of those rows 404s a live page. The grouping logic keeps
  // every slug row by construction; this asserts it rather than trusting it.
  const slugIds = new Set()
  for (const [, members] of groups) for (const r of members) if (r.slug) slugIds.add(r.id)
  const doomedSlugs = deleteIds.filter((id) => slugIds.has(id))
  if (doomedSlugs.length) problems.push(`${doomedSlugs.length} published page(s) in the delete set, e.g. ${doomedSlugs[0]}`)
  console.log(`  published rows in the catalog: ${slugIds.size.toLocaleString()}, of which queued for deletion: ${doomedSlugs.length}`)
  if (problems.length) {
    console.error('\nREFUSING TO PROCEED:')
    for (const p of problems) console.error('  - ' + p)
    process.exit(1)
  }
  console.log('\n  sanity checks passed (no referenced id queued; every product keeps a row)')

  if (!EXECUTE) {
    console.log('\nDry run only. Re-run with --execute to delete.')
    return
  }

  console.log(`\nDeleting in batches of ${DELETE_BATCH}...`)
  let done = 0
  let failed = 0
  for (let i = 0; i < deleteIds.length; i += DELETE_BATCH) {
    const batch = deleteIds.slice(i, i + DELETE_BATCH)
    const { error } = await db.from('ai_tools').delete().in('id', batch)
    if (error) {
      failed += batch.length
      console.error(`  batch at ${i}: ${error.message}`)
    } else {
      done += batch.length
    }
    if (i % (DELETE_BATCH * 25) === 0) {
      console.log(`  ${done.toLocaleString()} / ${deleteIds.length.toLocaleString()}`)
    }
    await sleep(PAUSE_MS)
  }

  console.log(`\nDeleted ${done.toLocaleString()}, failed ${failed.toLocaleString()}.`)
  console.log(
    '\nNow run this in the Supabase SQL editor — a delete of this size leaves\n' +
      'bloat and stale statistics, and §2 records latency not recovering on its own:\n\n' +
      '  VACUUM ANALYZE ai_tools;\n'
  )
}

main().catch((e) => {
  console.error('\nFailed:', e.message)
  process.exit(1)
})
