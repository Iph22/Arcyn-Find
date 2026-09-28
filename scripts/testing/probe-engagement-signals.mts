/**
 * What real engagement signal exists, and how much of it.
 *
 * Read-only. Written because "popular categories" and "AI suggestions" are
 * being rebuilt on real data, and the honest version of that depends entirely
 * on which of these tables has rows. docs/CORPUS_AND_CONSTRAINTS.md warns that
 * a plausible-looking number here is often a truncation, so every count below
 * is a `head: true` exact count rather than a fetched array's length.
 *
 * Run: npx tsx --env-file=.env.local scripts/testing/probe-engagement-signals.mts
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function count(table: string): Promise<string> {
  const { count: n, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
  if (error) return `error: ${error.message}`
  return String(n ?? 0)
}

async function main() {
  console.log('Row counts for every table that could carry engagement signal:\n')
  for (const table of ['search_cache', 'tool_views', 'user_favorites', 'tool_reviews', 'user_profiles']) {
    console.log(`  ${table.padEnd(16)} ${await count(table)}`)
  }

  console.log('\nTop search queries (search_cache, global):')
  const { data: searches, error: searchError } = await supabase
    .from('search_cache')
    .select('query_text, use_count, last_used_at')
    .order('use_count', { ascending: false })
    .limit(15)
  if (searchError) console.log(`  error: ${searchError.message}`)
  else if (!searches?.length) console.log('  (empty)')
  else for (const row of searches) {
    console.log(`  ${String(row.use_count).padStart(5)}  ${row.query_text}`)
  }

  console.log('\ntool_views shape + volume:')
  const { data: views, error: viewError } = await supabase
    .from('tool_views')
    .select('*')
    .limit(3)
  if (viewError) console.log(`  error: ${viewError.message}`)
  else if (!views?.length) console.log('  (empty -- no view has ever been recorded)')
  else console.log('  columns:', Object.keys(views[0]).join(', '))

  console.log('\nDo ai_tools carry usable popularity signal yet?')
  for (const column of ['trending_score', 'view_count_7d', 'view_count_30d']) {
    const { count: n, error } = await supabase
      .from('ai_tools')
      .select('*', { count: 'exact', head: true })
      .not(column, 'is', null)
    console.log(`  ${column.padEnd(16)} ${error ? `error: ${error.message}` : `${n ?? 0} non-null`}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
