#!/usr/bin/env node
/**
 * Copy data from one Supabase project to another.
 *
 *     node --env-file=.env.local scripts/migration/transfer-to-new-project.mjs --dry-run
 *     node --env-file=.env.local scripts/migration/transfer-to-new-project.mjs
 *     node --env-file=.env.local scripts/migration/transfer-to-new-project.mjs --only=ai_tools
 *
 * Reads the OLD project from the usual NEXT_PUBLIC_SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY, and the NEW one from:
 *
 *     NEW_SUPABASE_URL=https://<new-ref>.supabase.co
 *     NEW_SUPABASE_SERVICE_ROLE_KEY=<new service_role key>
 *
 * Run supabase/bootstrap/ against the new project FIRST. This copies rows into
 * tables; it does not create them.
 *
 * ---------------------------------------------------------------------------
 * !! THIS CANNOT READ A RESTRICTED PROJECT !!
 *
 * On 2026-09-28 the source project was restricted for exceeding its egress
 * quota, and EVERY path through the API gateway answers 402:
 *
 *     REST read / OpenAPI schema / RPC / Storage / Auth   all HTTP 402
 *     "Service for this project is restricted due to the following
 *      violations: exceed_egress_quota."
 *
 * PostgREST is behind that gateway, so this script fails on the first read
 * until the project is unrestricted. The restriction is applied at the
 * gateway, NOT at Postgres, so the direct database connection is usually still
 * reachable. Prefer that route while a project is restricted:
 *
 *     # Settings > Database > Connection string (needs the DB password)
 *     supabase db dump --db-url "postgresql://postgres.<ref>:<pw>@<host>:5432/postgres" \
 *       --data-only --schema public -f old-data.sql
 *
 * This script remains the right tool once the project is healthy, or for
 * moving data between two working projects.
 *
 * WHY IT IS A SCRIPT AND NOT pg_dump BY DEFAULT
 *
 * pg_dump needs a direct Postgres connection string, which is not in this
 * repo's .env.local -- only the PostgREST URL and keys are. This uses what is
 * actually available.
 *
 * WHAT IT COSTS
 *
 * Reading the old project is EGRESS, on a project that was already 217% over
 * quota. Measured 2026-09-25:
 *
 *     ai_tools rows              15,275      ~11 MB without embeddings
 *     ai_tools with embedding     4,174      ~63 MB of vectors alone
 *     all user-owned tables         141      negligible
 *
 * So a full transfer is roughly 75 MB, nearly all of it vectors. That is
 * deliberate and worth paying: re-generating 4,174 embeddings instead would
 * take FIVE DAYS against the Gemini free tier's 1,000/day
 * (docs/CORPUS_AND_CONSTRAINTS.md §4). Pass --no-embeddings to skip them and
 * let the hourly backfill refill over a week.
 *
 * HOW IT READS AND WRITES
 *
 * Reads use keyset pagination, never OFFSET -- §6 measured deep offsets timing
 * out at ~87k rows. Writes are chunked at 250, because §7 measured writes to
 * an indexed table as superlinear: 50 rows 753ms, 500 rows 2.1s, 1000 rows
 * statement timeout.
 *
 * Every write is an upsert on the primary key, so the script is idempotent and
 * resumable. If it dies halfway, run it again.
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const NO_EMBEDDINGS = args.includes('--no-embeddings')
const ONLY = args.find((a) => a.startsWith('--only='))?.split('=')[1]

/**
 * Load rows from a local dump directory instead of reading the source project.
 *
 * This is the mode to use while the old project is restricted: PostgREST
 * answers 402 on every request, so there is nothing to read from. Take the
 * data out over a direct Postgres connection first --
 * scripts/migration/dump-via-postgres.mjs -- then point this at the result.
 *
 * The destination is still written through PostgREST, which is fine: the NEW
 * project is not restricted.
 */
const FROM_DIR = args.find((a) => a.startsWith('--from-dir='))?.split('=')[1]

const SRC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SRC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DST_URL = process.env.NEW_SUPABASE_URL
const DST_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY

const READ_PAGE = 500
const WRITE_CHUNK = 250

/**
 * Tables in dependency order: a table is only listed after everything its
 * foreign keys point at. Getting this wrong surfaces as a foreign key
 * violation on insert rather than anything subtle, but ordering it correctly
 * means the run does not need to be repeated to settle.
 *
 * `key` is the conflict target for the upsert -- the primary key.
 */
const TABLES = [
  // Parents first. Everything user-owned points at one of these two.
  { name: 'ai_tools', key: 'id' },
  { name: 'user_profiles', key: 'id' },

  // User-owned data. Tiny (141 rows total, measured) but it is the data that
  // cannot be regenerated -- see the note about sign-in below.
  { name: 'collections', key: 'id' },
  { name: 'collection_items', key: 'id' },
  { name: 'user_favorites', key: 'id' },
  { name: 'tool_reviews', key: 'id' },
  { name: 'review_helpful_votes', key: 'id' },
  { name: 'user_follows', key: 'id' },
  { name: 'user_activities', key: 'id' },
  { name: 'price_alerts', key: 'id' },
  { name: 'push_subscriptions', key: 'id' },

  // Operational history. Worth keeping, cheap to move.
  { name: 'pricing_history', key: 'id' },
  { name: 'tool_submissions', key: 'id' },
  { name: 'contact_submissions', key: 'id' },
  { name: 'recommendation_feedback', key: 'id' },
  { name: 'notification_log', key: 'id' },
]

/**
 * Deliberately NOT transferred.
 *
 *   search_cache    A cache. It refills itself on use, and §4 measured ~76% of
 *                   its rows as keystroke fragments never looked up twice.
 *                   Copying it would move the storage problem to the new
 *                   project on day one.
 *   catalog_stats   Recomputed by catalog_stats_current() at most once a day.
 *   tool_views      30-day retention, and trending recomputes from it. Moving
 *                   it preserves trending continuity; leaving it means a few
 *                   days of flat trending scores. Add it to TABLES if you care.
 *   user_stats      A VIEW, not a table. It computes from the tables above.
 */
const SKIPPED = ['search_cache', 'catalog_stats', 'tool_views', 'user_stats']

function die(message) {
  console.error(`\n  ERROR  ${message}\n`)
  process.exit(1)
}

if (!FROM_DIR && (!SRC_URL || !SRC_KEY)) {
  die('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (the OLD project).')
}
if (FROM_DIR && !fs.existsSync(FROM_DIR)) {
  die(`--from-dir=${FROM_DIR} does not exist. Run dump-via-postgres.mjs first.`)
}
if (!DST_URL || !DST_KEY) {
  die(
    'Missing NEW_SUPABASE_URL / NEW_SUPABASE_SERVICE_ROLE_KEY.\n' +
      '         Add them to .env.local:\n\n' +
      '           NEW_SUPABASE_URL=https://<new-ref>.supabase.co\n' +
      '           NEW_SUPABASE_SERVICE_ROLE_KEY=<new service_role key>'
  )
}
if (!FROM_DIR && SRC_URL === DST_URL) {
  die('Source and destination are the same project. Check NEW_SUPABASE_URL.')
}

const srcHeaders = { apikey: SRC_KEY, Authorization: `Bearer ${SRC_KEY}` }
const dstHeaders = {
  apikey: DST_KEY,
  Authorization: `Bearer ${DST_KEY}`,
  'Content-Type': 'application/json',
}

let bytesRead = 0

/** One page of a table, keyset-paginated on the primary key. */
async function readPage(table, key, after) {
  const params = new URLSearchParams({ select: '*', order: `${key}.asc`, limit: String(READ_PAGE) })
  if (after !== null) params.set(key, `gt.${after}`)

  const res = await fetch(`${SRC_URL}/rest/v1/${table}?${params}`, { headers: srcHeaders })
  const text = await res.text()
  bytesRead += Buffer.byteLength(text)

  if (!res.ok) throw new Error(`read ${table}: ${res.status} ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

async function writeChunk(table, key, rows) {
  const res = await fetch(`${DST_URL}/rest/v1/${table}?on_conflict=${key}`, {
    method: 'POST',
    headers: {
      ...dstHeaders,
      // merge-duplicates makes this an upsert, which is what makes the whole
      // script resumable. return=minimal keeps the response empty -- asking
      // for the rows back would double the bandwidth for no reason.
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`write ${table}: ${res.status} ${(await res.text()).slice(0, 300)}`)
}

/**
 * Rows for one table, from the local dump, in pages of the same size the
 * network path uses so the write loop below is identical either way.
 */
function* readFromDir(table) {
  const file = path.join(FROM_DIR, `${table}.json`)
  if (!fs.existsSync(file)) return
  const all = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (let i = 0; i < all.length; i += READ_PAGE) yield all.slice(i, i + READ_PAGE)
}

async function transfer({ name, key }) {
  process.stdout.write(`  ${name.padEnd(24)}`)

  let after = null
  let moved = 0
  const fromDir = FROM_DIR ? readFromDir(name) : null

  for (;;) {
    const page = fromDir ? (fromDir.next().value ?? []) : await readPage(name, key, after)
    if (page.length === 0) break

    const rows = NO_EMBEDDINGS && name === 'ai_tools'
      ? page.map(({ embedding: _embedding, ...rest }) => rest)
      : page

    if (!DRY_RUN) {
      for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
        await writeChunk(name, key, rows.slice(i, i + WRITE_CHUNK))
      }
    }

    moved += page.length
    after = page[page.length - 1][key]
    process.stdout.write('.')

    // A short page means the table is drained. PostgREST caps a response at
    // 1000 rows (§2), so a full page is never proof there is nothing more.
    // The generator signals the same way by yielding a short final slice.
    if (page.length < READ_PAGE) break
  }

  console.log(` ${moved} rows${DRY_RUN ? ' (dry run, nothing written)' : ''}`)
  return moved
}

const selected = ONLY ? TABLES.filter((t) => t.name === ONLY) : TABLES
if (selected.length === 0) die(`--only=${ONLY} matched no table. Known: ${TABLES.map((t) => t.name).join(', ')}`)

console.log(`\n  ${DRY_RUN ? 'DRY RUN — reading only, nothing written' : 'TRANSFER'}`)
console.log(`  from ${SRC_URL}`)
console.log(`  to   ${DST_URL}`)
if (NO_EMBEDDINGS) console.log('  embeddings: SKIPPED (the hourly backfill will refill, ~5 days)')
console.log()

let total = 0
for (const table of selected) {
  try {
    total += await transfer(table)
  } catch (error) {
    console.log()
    die(
      `${error.message}\n\n` +
        '         Nothing is lost -- every write is an upsert on the primary key,\n' +
        '         so fix the cause and run the script again. It will skip what\n' +
        '         already landed.'
    )
  }
}

console.log(`\n  ${total} rows across ${selected.length} tables`)
if (FROM_DIR) {
  console.log(`  read from ${FROM_DIR}/ — no egress on the old project`)
} else {
  console.log(`  ~${(bytesRead / 1048576).toFixed(1)} MB read from the old project (egress)`)
}
if (!ONLY) console.log(`  skipped by design: ${SKIPPED.join(', ')}`)
console.log()
