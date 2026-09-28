/**
 * Distribution of the popularity-ish columns, and of the views behind them.
 *
 * A non-null count is not evidence of signal: a column backfilled to 0 for
 * every row is 100% non-null and carries nothing. This asks what the values
 * actually are.
 *
 * Run: npx tsx --env-file=.env.local scripts/testing/probe-engagement-distribution.mts
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function nonZero(column: string) {
  const { count, error } = await supabase
    .from('ai_tools')
    .select('*', { count: 'exact', head: true })
    .gt(column, 0)
  return error ? `error: ${error.message}` : `${count ?? 0} rows with ${column} > 0`
}

async function main() {
  for (const column of ['trending_score', 'view_count_7d']) {
    console.log(await nonZero(column))
  }

  const { data: top, error } = await supabase
    .from('ai_tools')
    .select('name, category, trending_score, view_count_7d')
    .order('trending_score', { ascending: false })
    .limit(10)
  console.log('\nHighest trending_score:')
  if (error) console.log(`  error: ${error.message}`)
  else for (const row of top ?? []) {
    console.log(`  ${String(row.trending_score).padStart(6)}  views7d=${String(row.view_count_7d).padStart(4)}  ${row.name} (${row.category})`)
  }

  const { data: views, error: viewError } = await supabase
    .from('tool_views')
    .select('tool_id, source, viewed_at')
    .order('viewed_at', { ascending: false })
    .limit(50)
  console.log('\ntool_views: how many distinct tools, and over what window?')
  if (viewError) {
    console.log(`  error: ${viewError.message}`)
  } else {
    const rows = views ?? []
    const distinct = new Set(rows.map((r) => r.tool_id)).size
    const stamps = rows.map((r) => r.viewed_at).filter(Boolean).sort()
    console.log(`  ${rows.length} most recent views cover ${distinct} distinct tools`)
    if (stamps.length) console.log(`  from ${stamps[0]} to ${stamps[stamps.length - 1]}`)
    const bySource = new Map<string, number>()
    for (const r of rows) bySource.set(r.source ?? 'null', (bySource.get(r.source ?? 'null') ?? 0) + 1)
    console.log('  by source:', [...bySource].map(([s, n]) => `${s}=${n}`).join(' '))
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
