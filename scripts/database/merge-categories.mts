#!/usr/bin/env node
/**
 * Fold duplicate category spellings into the one that owns the landing page.
 *
 *   npm run categories:dry     report only, touches nothing   (default)
 *   npm run categories         apply, in paced batches
 *
 * WHY
 *
 * `ai_tools.category` is scraped, and the same category arrived under several
 * names. Measured 2026-09-23 across 15,275 rows: 35 distinct values, of which
 * nine are variants of a category that already exists.
 *
 * The category pages already survive this -- `loadCategoryIndex` groups by
 * slug, so `ChatBots` and `Chatbots` are one page -- but nothing else does.
 * The split values still divide the candidate pool, still appear in filters,
 * and still count separately anywhere a category is counted.
 *
 * `Gaming` (4 published) and `Gaming & Entertainment` (20) do not slugify to
 * the same thing, so they are two categories in every count and one of them is
 * four tools short of a page it should never have needed.
 *
 * EVERY MERGE IS LISTED, NOT INFERRED
 *
 * A heuristic on category names would fold things that only look alike. Each
 * pair below is a judgement someone made, and the ones deliberately NOT merged
 * are recorded with it -- that list is the more useful half.
 */

import { createClient } from '@supabase/supabase-js'

const EXECUTE = process.argv.includes('--execute')
const WRITE_CHUNK = 25
const WRITE_PAUSE_MS = 120

/**
 * from -> to. Both sides are raw `ai_tools.category` values.
 *
 * Deliberately NOT merged:
 *
 *   Research Paper (203 rows, 0 published)
 *     Reads like arXiv entries rather than tools. Folding it into
 *     `Research & Open Source` would flatten a real distinction on a guess,
 *     and neither has enough published rows to earn a page either way.
 *   ML Infrastructure (57 rows, 0 published)
 *     A genuine category, not a variant of one. It has no page because
 *     nothing in it is published, which is a different problem.
 *   Audio/NLP (15 rows, 0 published)
 *     Ambiguous by construction -- it could belong to `Audio & Music` or to
 *     `NLP & Text Analysis`, and the name does not say which.
 *   Computer Vision (19 rows, 18 published)
 *     Not a duplicate at all. It is two published tools short of the
 *     20-member floor, which categorisation cannot fix.
 */
const MERGES: Record<string, string> = {
  Chatbots: 'ChatBots', // case-only split
  Translation: 'Translation & Language',
  Marketing: 'Marketing & Sales',
  Gaming: 'Gaming & Entertainment',
  Education: 'Learning & Education',
  Research: 'Research & Open Source',
  'Code Generation': 'Code & Development',
  'Text Generation': 'Writing & Content',
  'Autonomous AI': 'AI Agents',
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing env. Run: npm run categories:dry')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Row {
  id: string
  category: string | null
  slug: string | null
}

async function loadAll(): Promise<Row[]> {
  const rows: Row[] = []
  let cursor: string | null = null
  for (let page = 0; page < 40; page++) {
    let q = db.from('ai_tools').select('id, category, slug').order('id', { ascending: true }).limit(1000)
    if (cursor) q = q.gt('id', cursor)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    rows.push(...(data as Row[]))
    if (data.length < 1000) break
    cursor = (data as Row[])[data.length - 1].id
  }
  return rows
}

async function main() {
  console.log(EXECUTE ? 'MERGE CATEGORIES — EXECUTING\n' : 'MERGE CATEGORIES — DRY RUN\n')

  const rows = await loadAll()
  const counts = new Map<string, { total: number; published: number }>()
  for (const r of rows) {
    if (!r.category) continue
    const e = counts.get(r.category) ?? { total: 0, published: 0 }
    e.total++
    if (r.slug) e.published++
    counts.set(r.category, e)
  }

  // A target that does not exist means the catalog moved under this list.
  // Merging into it would invent a category rather than consolidate one.
  const missing = [...new Set(Object.values(MERGES))].filter((to) => !counts.has(to))
  if (missing.length) {
    console.error('REFUSING TO PROCEED — these merge targets do not exist:')
    for (const m of missing) console.error(`  ${m}`)
    process.exit(1)
  }

  const plan: Array<{ from: string; to: string; rows: Row[] }> = []
  for (const [from, to] of Object.entries(MERGES)) {
    const affected = rows.filter((r) => r.category === from)
    if (affected.length) plan.push({ from, to, rows: affected })
  }

  console.log(`  rows walked        ${rows.length.toLocaleString()}`)
  console.log(`  distinct categories ${counts.size}\n`)
  console.log('  from                    rows  pub  ->  to')
  console.log('  ' + '-'.repeat(62))
  for (const p of plan) {
    const c = counts.get(p.from)!
    const t = counts.get(p.to)!
    console.log(
      `  ${p.from.padEnd(22)} ${String(c.total).padStart(4)} ${String(c.published).padStart(4)}  ->  ` +
        `${p.to} (${t.total} rows, ${t.published} pub)`
    )
  }

  const totalRows = plan.reduce((s, p) => s + p.rows.length, 0)
  console.log(`\n  categories after   ${counts.size - plan.length}`)
  console.log(`  rows to update     ${totalRows}`)

  if (!EXECUTE) {
    console.log('\nDry run only. Re-run with --execute to apply.')
    return
  }

  console.log(`\nUpdating in chunks of ${WRITE_CHUNK} ...`)
  let done = 0
  let failed = 0
  for (const p of plan) {
    for (let i = 0; i < p.rows.length; i += WRITE_CHUNK) {
      const chunk = p.rows.slice(i, i + WRITE_CHUNK)
      const { error } = await db
        .from('ai_tools')
        .update({ category: p.to })
        .in(
          'id',
          chunk.map((r) => r.id)
        )
      if (error) {
        failed += chunk.length
        console.error(`  ${p.from} -> ${p.to}: ${error.message}`)
      } else {
        done += chunk.length
      }
      await sleep(WRITE_PAUSE_MS)
    }
    console.log(`  ${p.from} -> ${p.to}: ${p.rows.length} rows`)
  }

  console.log(`\nUpdated ${done}, failed ${failed}.`)
  if (done > 0) {
    console.log('\nRun `VACUUM ANALYZE ai_tools;` afterwards (§2), and force the cached')
    console.log('figures to recompute with `catalog_stats_current(\'0 seconds\')`.')
  }
}

main().catch((e) => {
  console.error('\nFailed:', e.message)
  process.exit(1)
})
