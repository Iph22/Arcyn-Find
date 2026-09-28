/**
 * Why is search_cache empty?
 *
 * /api/ai-models calls increment_search_count() on every search of 3+ chars,
 * with an upsert fallback, inside a try/catch that swallows everything. So a
 * total failure and a path that never runs look identical from the outside --
 * and the table has 0 rows. This asks the database directly.
 *
 * Writes one row under a probe query string, then removes it.
 *
 * Run: npx tsx --env-file=.env.local scripts/testing/probe-search-tracking.mts
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

const PROBE = `__probe__ ${Date.now()}`

async function main() {
  console.log('1. Does increment_search_count() exist and run?')
  const { error: rpcError } = await supabase.rpc('increment_search_count', { search_query: PROBE })
  console.log(rpcError ? `   FAIL ${rpcError.code ?? ''} ${rpcError.message}` : '   OK   rpc returned without error')

  console.log('\n2. Did the row land?')
  const { data: after, error: readError } = await supabase
    .from('search_cache')
    .select('query_text, use_count')
    .eq('query_text', PROBE)
    .maybeSingle()
  if (readError) console.log(`   FAIL read: ${readError.message}`)
  else console.log(after ? `   OK   use_count=${after.use_count}` : '   FAIL rpc succeeded but no row exists')

  console.log('\n3. Does the upsert fallback work?')
  const { error: upsertError } = await supabase
    .from('search_cache')
    .upsert({ query_text: `${PROBE} fallback`, use_count: 1 }, { onConflict: 'query_text' })
  console.log(upsertError ? `   FAIL ${upsertError.code ?? ''} ${upsertError.message}` : '   OK   upsert accepted')

  console.log('\nCleaning up probe rows.')
  await supabase.from('search_cache').delete().like('query_text', '__probe__%')

  const { count } = await supabase
    .from('search_cache')
    .select('*', { count: 'exact', head: true })
  console.log(`search_cache now holds ${count ?? 0} rows.`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
