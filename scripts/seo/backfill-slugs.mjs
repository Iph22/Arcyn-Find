#!/usr/bin/env node
/**
 * Assign a public URL slug to one row per distinct product.
 *
 * Run:
 *   node --env-file=.env.local scripts/seo/backfill-slugs.mjs --dry-run
 *   node --env-file=.env.local scripts/seo/backfill-slugs.mjs
 *
 * Requires supabase/migrations/add_tool_slugs.sql to have been applied.
 *
 * Shaped by docs/CORPUS_AND_CONSTRAINTS.md:
 *   §1  55% of the corpus is duplicate re-ingests. Dedupe on normalized name
 *       before writing, exactly as search_tools_advanced does, or the same
 *       product gets hundreds of pages.
 *   §2  No select('*') (pulls the embedding column). Keyset pagination, not
 *       offsets. .update() rather than .upsert(), because an upsert with a
 *       partial payload becomes INSERT ... ON CONFLICT and fails NOT NULL.
 *   §2  Bulk UPDATEs have a blast radius: 300 writes previously pushed an
 *       unrelated query from 2.8s to timing out and it did not recover.
 *       Hence the throttle, and the VACUUM ANALYZE reminder at the end.
 */

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const MIN_POPULARITY = 90
const PAGE_SIZE = 1000
const WRITE_CHUNK = 25
const WRITE_PAUSE_MS = 120

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run with: node --env-file=.env.local scripts/seo/backfill-slugs.mjs'
  )
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

// Kept byte-identical in behaviour to lib/seo/slug.ts. If these drift, the
// sitemap emits URLs the page router cannot resolve.
const normalizeName = (name) =>
  (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const slugify = (value) =>
  (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Walk the publishable band with keyset pagination on id. */
async function loadBand() {
  const rows = []
  let cursor = null

  for (let page = 0; page < 40; page++) {
    let query = db
      .from('ai_tools')
      .select('id, name, category, description, popularity, slug')
      .gte('popularity', MIN_POPULARITY)
      .order('id', { ascending: true })
      .limit(PAGE_SIZE)

    if (cursor) query = query.gt('id', cursor)

    const started = Date.now()
    const { data, error } = await query
    if (error) throw new Error(`page ${page}: ${error.message}`)

    rows.push(...data)
    console.log(`  page ${page}: ${data.length} rows (${Date.now() - started}ms)`)

    // A full page is PostgREST's 1000-row cap, not necessarily the end.
    if (data.length < PAGE_SIZE) break
    cursor = data[data.length - 1].id
  }

  return rows
}

/**
 * Of the N rows that are the same product, pick the one that makes the best
 * page: longest description wins, then popularity, then a stable id tiebreak
 * so re-runs are deterministic.
 */
function pickBest(group) {
  return [...group].sort((a, b) => {
    const byDescription = (b.description || '').length - (a.description || '').length
    if (byDescription !== 0) return byDescription
    const byPopularity = (b.popularity || 0) - (a.popularity || 0)
    if (byPopularity !== 0) return byPopularity
    return String(a.id).localeCompare(String(b.id))
  })[0]
}

/** Fail with the remedy rather than a raw Postgres error. */
async function assertSlugColumn() {
  const { error } = await db.from('ai_tools').select('slug').limit(1)
  if (error && /column .*slug.* does not exist/i.test(error.message)) {
    console.error(
      'The `slug` column does not exist yet.\n\n' +
        'Apply supabase/migrations/add_tool_slugs.sql first -- paste it into the\n' +
        'Supabase SQL editor (Dashboard -> SQL Editor -> New query), run it, then\n' +
        're-run this script.\n'
    )
    process.exit(1)
  }
  if (error) throw new Error(error.message)
}

async function main() {
  await assertSlugColumn()

  console.log(`Loading rows with popularity >= ${MIN_POPULARITY} ...`)
  const rows = await loadBand()
  console.log(`Loaded ${rows.length} rows.\n`)

  const groups = new Map()
  for (const row of rows) {
    const key = normalizeName(row.name)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  console.log(`Distinct products: ${groups.size} (from ${rows.length} rows)`)

  const assignments = []
  const takenSlugs = new Set()
  let skippedNoSlug = 0

  // Deterministic order so collision suffixes are stable across runs.
  const orderedKeys = [...groups.keys()].sort()

  for (const key of orderedKeys) {
    const winner = pickBest(groups.get(key))
    const base = slugify(winner.name)
    if (!base) {
      skippedNoSlug++
      continue
    }

    let slug = base
    let suffix = 2
    while (takenSlugs.has(slug)) {
      slug = `${base}-${suffix++}`
    }
    takenSlugs.add(slug)

    if (winner.slug !== slug) {
      assignments.push({ id: winner.id, name: winner.name, slug, previous: winner.slug })
    }
  }

  // Rows that previously held a slug but are no longer the chosen winner must
  // lose it, or the partial unique index will reject the new owner.
  const winnerIds = new Set(assignments.map((a) => a.id))
  const stale = rows.filter(
    (row) => row.slug && !winnerIds.has(row.id) && !takenSlugs.has(row.slug)
  )

  console.log(`Slugs to write:   ${assignments.length}`)
  console.log(`Slugs to clear:   ${stale.length}`)
  console.log(`Names with no usable slug: ${skippedNoSlug}`)
  console.log('\nSample:')
  for (const a of assignments.slice(0, 10)) {
    console.log(`  ${a.slug.padEnd(38)} <- ${a.name}  [${a.id}]`)
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: nothing written.')
    return
  }

  console.log(`\nWriting in chunks of ${WRITE_CHUNK} ...`)
  let written = 0
  let failed = 0

  for (let i = 0; i < stale.length; i += WRITE_CHUNK) {
    const chunk = stale.slice(i, i + WRITE_CHUNK)
    await Promise.all(
      chunk.map(async (row) => {
        const { error } = await db.from('ai_tools').update({ slug: null }).eq('id', row.id)
        if (error) {
          failed++
          console.error(`  clear ${row.id}: ${error.message}`)
        }
      })
    )
    await sleep(WRITE_PAUSE_MS)
  }

  for (let i = 0; i < assignments.length; i += WRITE_CHUNK) {
    const chunk = assignments.slice(i, i + WRITE_CHUNK)
    await Promise.all(
      chunk.map(async (a) => {
        // .update(), never .upsert(): a partial upsert payload generates
        // INSERT ... ON CONFLICT and fails this table's NOT NULL columns.
        const { error } = await db.from('ai_tools').update({ slug: a.slug }).eq('id', a.id)
        if (error) {
          failed++
          console.error(`  ${a.id} -> ${a.slug}: ${error.message}`)
        } else {
          written++
        }
      })
    )
    if ((i / WRITE_CHUNK) % 10 === 0) {
      console.log(`  ${Math.min(i + WRITE_CHUNK, assignments.length)}/${assignments.length}`)
    }
    await sleep(WRITE_PAUSE_MS)
  }

  console.log(`\nWrote ${written} slugs, ${failed} failures.`)
  console.log(
    'Now run this in the Supabase SQL editor -- §2: a bulk UPDATE of this size\n' +
      'left stale statistics and index bloat last time, and query latency did\n' +
      'not recover on its own:\n\n  VACUUM ANALYZE ai_tools;\n'
  )
}

main().catch((error) => {
  console.error('\nBackfill failed:', error.message)
  process.exit(1)
})
