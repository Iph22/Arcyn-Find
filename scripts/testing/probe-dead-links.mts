/**
 * How many published tools point at a domain that no longer answers?
 *
 * A sample, not a census: a full sweep of every published tool is thousands of
 * outbound requests and belongs in a scheduled job, not a probe. This exists to
 * size the problem before building that job -- "some tools have expired
 * domains" is a report, and a rate is a decision.
 *
 * Read-only. Nothing is written or unpublished.
 *
 * Run: npx tsx --env-file=.env.local scripts/testing/probe-dead-links.mts [sampleSize]
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}

const SAMPLE = Number(process.argv[2] || 60)
const CONCURRENCY = 8
const TIMEOUT_MS = 12000

const supabase = createClient(url, key, { auth: { persistSession: false } })

type Row = { id: string; name: string; slug: string | null; platform: string | null }

/** What a single URL did when asked. */
type Verdict = 'ok' | 'dead' | 'blocked' | 'no-url'

async function probe(target: string): Promise<{ verdict: Verdict; detail: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    // GET, not HEAD: a surprising number of sites 405 a HEAD they would serve.
    const res = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'ArcynFind-LinkCheck/1.0 (+https://arcynfind.com)' },
    })
    if (res.status >= 500) return { verdict: 'dead', detail: `HTTP ${res.status}` }
    if (res.status === 404 || res.status === 410) return { verdict: 'dead', detail: `HTTP ${res.status}` }
    // 401/403 usually means a bot wall, not a dead product.
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return { verdict: 'blocked', detail: `HTTP ${res.status}` }
    }
    return { verdict: 'ok', detail: `HTTP ${res.status}` }
  } catch (error) {
    const message = (error as Error).message || ''
    const cause = (error as { cause?: { code?: string } }).cause?.code || ''
    // ENOTFOUND is the one that means "this domain does not resolve", which is
    // the closest signal available to "the registration lapsed".
    if (cause === 'ENOTFOUND' || cause === 'EAI_AGAIN') return { verdict: 'dead', detail: 'DNS does not resolve' }
    if (message.includes('aborted')) return { verdict: 'blocked', detail: `no answer in ${TIMEOUT_MS}ms` }
    return { verdict: 'dead', detail: cause || message.slice(0, 60) }
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  // Published tools only -- those are the ones a visitor can reach.
  const { data, error } = await supabase
    .from('ai_tools')
    .select('id, name, slug, platform')
    .not('slug', 'is', null)
    .order('popularity', { ascending: false })
    .limit(SAMPLE)

  if (error) {
    console.error('query failed:', error.message)
    process.exit(1)
  }

  const rows = (data ?? []) as Row[]
  console.log(`Probing ${rows.length} published tools, most popular first.\n`)

  const results: { row: Row; verdict: Verdict; detail: string }[] = []
  let cursor = 0

  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++]
      const target = (row.platform || '').trim()
      if (!/^https?:\/\//i.test(target)) {
        results.push({ row, verdict: 'no-url', detail: target ? 'not an http url' : 'empty' })
        continue
      }
      const { verdict, detail } = await probe(target)
      results.push({ row, verdict, detail })
      if (verdict !== 'ok') console.log(`  ${verdict.padEnd(8)} ${row.name} — ${detail}\n           ${target}`)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const count = (v: Verdict) => results.filter((r) => r.verdict === v).length
  console.log('\n--- summary ---')
  for (const v of ['ok', 'dead', 'blocked', 'no-url'] as Verdict[]) {
    const n = count(v)
    console.log(`  ${v.padEnd(8)} ${String(n).padStart(4)}  ${((n / results.length) * 100).toFixed(1)}%`)
  }
  console.log(
    '\n"blocked" is not "dead": a bot wall or a slow host answers that way and the product is fine.'
  )
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
