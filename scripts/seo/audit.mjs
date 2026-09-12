#!/usr/bin/env node
/**
 * Measure the public SEO layer against the live database.
 *
 * Run: npm run seo:audit
 *
 * Reports what is actually publishable and indexable rather than what the row
 * count suggests -- docs/CORPUS_AND_CONSTRAINTS.md §1: the corpus is 55%
 * duplicate re-ingests, so "260k rows" is not "260k pages".
 */

import { createClient } from '@supabase/supabase-js'

const MIN_POPULARITY = 90
const PAGE_SIZE = 1000

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const normalizeName = (name) =>
  (name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

const isTruncated = (d) => {
  const t = (d || '').trim()
  return t.length >= 150 && !/[.!?]$/.test(t)
}

/** Mirrors isIndexable() in lib/seo/catalog.ts -- keep the two in step. */
const isIndexable = (row) => {
  const d = (row.description || '').trim()
  if (d.length < 120) return false
  if (/^AI tool mentioned in:/i.test(d)) return false
  if (d.split(/\s+/).filter(Boolean).length < 25) return false
  if (!row.tags || row.tags.length < 2) return false
  if (!row.image) return false
  if (!row.platform) return false
  return true
}

/** Set once the schema is probed; `slug` cannot be selected before it exists. */
let COLUMNS = 'id, name, category, description, tags, popularity, image, platform'

async function walk(applyFilter) {
  const rows = []
  let cursor = null
  for (let i = 0; i < 40; i++) {
    let q = db
      .from('ai_tools')
      .select(COLUMNS)
      .order('id', { ascending: true })
      .limit(PAGE_SIZE)
    q = applyFilter(q)
    if (cursor) q = q.gt('id', cursor)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    cursor = data[data.length - 1].id
  }
  return rows
}

function bar(n, total, width = 28) {
  const filled = total === 0 ? 0 : Math.round((n / total) * width)
  return '#'.repeat(filled) + '.'.repeat(width - filled)
}

async function main() {
  const { error: colError } = await db.from('ai_tools').select('slug').limit(1)
  const hasSlugColumn = !colError
  if (hasSlugColumn) COLUMNS = `${COLUMNS}, slug`

  console.log('Arcyn Find - SEO layer audit')
  console.log('='.repeat(62))

  if (!hasSlugColumn) {
    console.log('\n  slug column: MISSING')
    console.log('  Apply supabase/migrations/add_tool_slugs.sql, then npm run seo:slugs\n')
  }

  const band = await walk((q) => q.gte('popularity', MIN_POPULARITY))
  const distinct = new Set(band.map((r) => normalizeName(r.name)))

  console.log(`\nCandidate band (popularity >= ${MIN_POPULARITY})`)
  console.log(`  rows                 ${band.length}`)
  console.log(`  distinct products    ${distinct.size}`)
  console.log(`  duplicate rows       ${band.length - distinct.size}`)

  const truncated = band.filter((r) => isTruncated(r.description)).length
  const noTags = band.filter((r) => !r.tags || r.tags.length === 0).length
  const noImage = band.filter((r) => !r.image).length
  console.log(`\nContent quality (of ${band.length} rows)`)
  console.log(`  truncated blurb      ${String(truncated).padStart(5)}  ${bar(truncated, band.length)}`)
  console.log(`  no tags              ${String(noTags).padStart(5)}  ${bar(noTags, band.length)}`)
  console.log(`  no image             ${String(noImage).padStart(5)}  ${bar(noImage, band.length)}`)

  if (!hasSlugColumn) {
    const wouldIndex = band.filter(isIndexable).length
    console.log(`\nProjected after backfill`)
    console.log(`  pages published      ${distinct.size}`)
    console.log(`  of those, indexable  ~${wouldIndex}`)
    return
  }

  const published = await walk((q) => q.not('slug', 'is', null))
  const indexable = published.filter(isIndexable)

  console.log(`\nPublished pages`)
  console.log(`  /tools/<slug>        ${published.length}`)
  console.log(`  indexable            ${indexable.length}  ${bar(indexable.length, published.length)}`)
  console.log(`  noindex, follow      ${published.length - indexable.length}`)

  const slugs = published.map((r) => r.slug)
  const dupeSlugs = slugs.length - new Set(slugs).size
  console.log(`  duplicate slugs      ${dupeSlugs}${dupeSlugs ? '   <- BUG' : ''}`)

  const categories = {}
  for (const row of published) {
    if (!row.category) continue
    categories[row.category] = categories[row.category] || { total: 0, indexable: 0 }
    categories[row.category].total++
    if (isIndexable(row)) categories[row.category].indexable++
  }

  console.log(`\nCategory pages (>= 20 products earns a page)`)
  const sorted = Object.entries(categories).sort((a, b) => b[1].total - a[1].total)
  for (const [name, c] of sorted) {
    const published = c.total >= 20
    const indexed = c.indexable >= 5
    const flag = !published ? 'no page' : indexed ? 'indexed' : 'noindex'
    console.log(`  ${name.padEnd(26)} ${String(c.total).padStart(5)} tools  ${String(c.indexable).padStart(5)} indexable  ${flag}`)
  }

  const pageCount = sorted.filter(([, c]) => c.total >= 20).length
  console.log(`\nSitemap will contain ~${8 + pageCount + indexable.length} URLs`)
  console.log(`  (8 static + ${pageCount} category + ${indexable.length} tool pages)`)
}

main().catch((error) => {
  console.error('\nAudit failed:', error.message)
  process.exit(1)
})
