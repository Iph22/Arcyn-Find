#!/usr/bin/env node
/**
 * Re-fetch the tool logos that were stranded in the old Supabase project.
 *
 *     node --env-file=.env.local scripts/images/rebuild-missing-logos.mjs --dry-run
 *     node --env-file=.env.local scripts/images/rebuild-missing-logos.mjs
 *     node --env-file=.env.local scripts/images/rebuild-missing-logos.mjs --limit=200
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS RATHER THAN `npm run fetch:logos`
 *
 * The database was migrated to a new project on 2026-09-28; Storage was not.
 * 4,802 rows still point `image` at the OLD project, which is restricted and
 * answers 402, so those logos are dead -- 3,580 of them on published pages.
 *
 * fetch-logos.js would do the job but walks all 15,371 rows with deep
 * `.range()` offsets to get there, which CORPUS_AND_CONSTRAINTS §6 measured as
 * timing out, and re-fetches tools whose external image URLs are still fine.
 * This targets exactly the broken set, keyset-paginated.
 *
 * WHAT IT COSTS
 *
 * Almost nothing against the Supabase quota. The read is narrow (id, name,
 * platform -- roughly 0.5 MB for the whole set) and the uploads are INGRESS,
 * which is not metered as egress. The real cost is time and politeness to
 * ~4,800 third-party websites, which is why it is rate limited.
 *
 * Idempotent: a row is only updated after its logo uploads successfully, so
 * re-running picks up whatever failed last time.
 * ---------------------------------------------------------------------------
 */

const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? Infinity)

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
/** The project whose storage went away. Rows still pointing here are the work. */
const DEAD_HOST = 'otrtjqomyukafgnyylij'
const BUCKET = 'tools'

if (!URL_ || !KEY) {
  console.error('\n  ERROR  run with --env-file=.env.local\n')
  process.exit(1)
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

/** Be a good citizen: these are other people's servers, ~4,800 of them. */
const CONCURRENCY = 6
const PER_REQUEST_TIMEOUT_MS = 8000

function hostOf(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

async function fetchWithTimeout(url, opts = {}) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), PER_REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...opts, signal: ac.signal, redirect: 'follow' })
  } finally {
    clearTimeout(t)
  }
}

/**
 * A tool's logo, from its own site.
 *
 * Google's favicon service first: it already solved favicon discovery,
 * normalises to PNG, and one request replaces the three-or-four probes that
 * guessing /favicon.ico, /favicon.png and parsing <link rel="icon"> would take
 * against a server that may not be expecting us. Falls back to the site's own
 * /favicon.ico when that returns nothing useful.
 */
async function findLogo(platform) {
  const origin = hostOf(platform)
  if (!origin) return null
  const domain = new URL(origin).hostname

  const candidates = [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `${origin}/favicon.ico`,
    `${origin}/favicon.png`,
  ]

  for (const url of candidates) {
    try {
      const r = await fetchWithTimeout(url)
      if (!r.ok) continue
      const type = r.headers.get('content-type') || ''
      if (!type.startsWith('image/')) continue
      const buf = Buffer.from(await r.arrayBuffer())
      // Google returns a 16x16 grey globe for domains it has nothing for.
      // Those are a few hundred bytes; a real icon is larger.
      if (buf.byteLength < 500) continue
      return { buf, type }
    } catch {
      // Dead domain, TLS failure, timeout. Expected at this scale.
    }
  }
  return null
}

async function upload(id, buf, type) {
  const ext = type.includes('png') ? 'png' : type.includes('svg') ? 'svg' : type.includes('jpeg') ? 'jpg' : 'ico'
  const path = `tools/${id}.${ext}`
  const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': type, 'x-upsert': 'true', 'cache-control': '31536000' },
    body: buf,
  })
  if (!r.ok) throw new Error(`upload ${r.status}: ${(await r.text()).slice(0, 120)}`)
  return `${URL_}/storage/v1/object/public/${BUCKET}/${path}`
}

async function setImage(id, url) {
  const r = await fetch(`${URL_}/rest/v1/ai_tools?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ image: url }),
  })
  if (!r.ok) throw new Error(`patch ${r.status}: ${(await r.text()).slice(0, 120)}`)
}

// Keyset pagination on id, not OFFSET (§6: deep offsets time out on this table).
async function* brokenRows() {
  let after = ''
  for (;;) {
    const params = new URLSearchParams({
      select: 'id,name,platform',
      image: `like.*${DEAD_HOST}*`,
      order: 'id.asc',
      limit: '500',
    })
    if (after) params.set('id', `gt.${after}`)
    const r = await fetch(`${URL_}/rest/v1/ai_tools?${params}`, { headers: H })
    if (!r.ok) throw new Error(`read ${r.status}: ${(await r.text()).slice(0, 200)}`)
    const page = await r.json()
    if (page.length === 0) return
    for (const row of page) yield row
    if (page.length < 500) return
    after = page[page.length - 1].id
  }
}

const stats = { seen: 0, fixed: 0, noPlatform: 0, noLogo: 0, failed: 0 }
const started = Date.now()

const queue = []
for await (const row of brokenRows()) {
  queue.push(row)
  if (queue.length >= LIMIT) break
}

console.log(`\n  ${queue.length} tools with a dead logo URL${DRY_RUN ? '  (dry run)' : ''}\n`)

async function work(row) {
  stats.seen++
  if (!row.platform) {
    stats.noPlatform++
    return
  }
  try {
    const logo = await findLogo(row.platform)
    if (!logo) {
      stats.noLogo++
      return
    }
    if (!DRY_RUN) {
      const url = await upload(row.id, logo.buf, logo.type)
      await setImage(row.id, url)
    }
    stats.fixed++
  } catch {
    stats.failed++
  }
  if (stats.seen % 100 === 0) {
    const rate = stats.seen / ((Date.now() - started) / 1000)
    const left = Math.round((queue.length - stats.seen) / Math.max(rate, 0.1) / 60)
    console.log(
      `  ${String(stats.seen).padStart(5)}/${queue.length}  fixed ${stats.fixed}  ` +
        `no-logo ${stats.noLogo}  failed ${stats.failed}  ~${left}m left`
    )
  }
}

// Fixed-size worker pool, so we never have more than CONCURRENCY requests out.
const iter = queue[Symbol.iterator]()
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (const row of iter) await work(row)
  })
)

console.log(`\n  done in ${Math.round((Date.now() - started) / 1000)}s`)
console.log(`  fixed ${stats.fixed}   no logo found ${stats.noLogo}   no platform ${stats.noPlatform}   errors ${stats.failed}`)
if (!DRY_RUN && stats.fixed) console.log(`\n  Re-run to retry the ones that failed.\n`)
