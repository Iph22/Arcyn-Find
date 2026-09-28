#!/usr/bin/env node
/**
 * Load a dump from dump-via-postgres.mjs into a project, over a DIRECT
 * Postgres connection.
 *
 *     node scripts/migration/load-via-postgres.mjs "<connection-string>" migration-dump
 *     node scripts/migration/load-via-postgres.mjs "<conn>" migration-dump --only=ai_tools
 *
 * The mirror of dump-via-postgres.mjs, and the counterpart to
 * transfer-to-new-project.mjs --from-dir. Use this one when you already have
 * the destination's Postgres connection string; use that one when you have its
 * PostgREST URL and service role key instead. Neither needs the other.
 *
 * Every row is INSERT ... ON CONFLICT (pk) DO UPDATE, so re-running is safe
 * and a failed run resumes by simply running it again.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let Client
try {
  ;({ Client } = require('pg'))
} catch {
  console.error('\n  ERROR  `pg` is not installed.  npm i pg --no-save\n')
  process.exit(1)
}

const [DB_URL, DIR = 'migration-dump'] = process.argv.slice(2)
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
const DRY_RUN = process.argv.includes('--dry-run')

if (!DB_URL?.startsWith('postgres')) {
  console.error('\n  usage: node scripts/migration/load-via-postgres.mjs "<connection-string>" [dump-dir]\n')
  process.exit(1)
}
if (!fs.existsSync(path.join(DIR, '_manifest.json'))) {
  console.error(`\n  ERROR  no _manifest.json in ${DIR}/. Run dump-via-postgres.mjs first.\n`)
  process.exit(1)
}

/**
 * Load order. Parents before children, because the foreign keys are real:
 * inserting a collection before its owner exists fails outright.
 */
const ORDER = [
  'ai_tools',
  'user_profiles',
  'collections',
  'collection_items',
  'user_favorites',
  'tool_reviews',
  'review_helpful_votes',
  'user_follows',
  'user_activities',
  'price_alerts',
  'push_subscriptions',
  'pricing_history',
  'tool_submissions',
  'contact_submissions',
  'recommendation_feedback',
  'notification_log',
  'tool_views',
]

/** §7 measured writes to an indexed table as superlinear. 250 is its finding. */
const CHUNK = 250

const manifest = JSON.parse(fs.readFileSync(path.join(DIR, '_manifest.json'), 'utf8'))
const pkFor = Object.fromEntries(manifest.tables.map((t) => [t.table, t.primaryKey]))

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300_000,
})

process.stdout.write('  connecting... ')
await client.connect()
console.log('ok\n')

let grand = 0

for (const table of ORDER) {
  if (ONLY && table !== ONLY) continue

  const file = path.join(DIR, `${table}.json`)
  if (!fs.existsSync(file)) continue

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (rows.length === 0) {
    console.log(`  ${table.padEnd(26)} empty`)
    continue
  }

  const pk = pkFor[table]
  if (!pk || pk.length === 0) {
    console.log(`  ${table.padEnd(26)} SKIPPED — no primary key recorded, cannot upsert safely`)
    continue
  }

  process.stdout.write(`  ${table.padEnd(26)}`)

  const cols = Object.keys(rows[0])
  const quoted = cols.map((c) => `"${c}"`).join(', ')
  const conflict = pk.map((c) => `"${c}"`).join(', ')
  // On conflict, refresh every non-key column. Re-running then repairs a
  // partially-loaded table rather than silently leaving it half old.
  const updates = cols
    .filter((c) => !pk.includes(c))
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(', ')

  let done = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const params = []
    const tuples = slice.map((row) => {
      const ph = cols.map((c) => {
        params.push(row[c] === undefined ? null : row[c])
        return `$${params.length}`
      })
      return `(${ph.join(', ')})`
    })

    const sql =
      `INSERT INTO "${table}" (${quoted}) VALUES ${tuples.join(', ')} ` +
      (updates ? `ON CONFLICT (${conflict}) DO UPDATE SET ${updates}` : `ON CONFLICT (${conflict}) DO NOTHING`)

    if (!DRY_RUN) {
      try {
        await client.query(sql, params)
      } catch (error) {
        console.log(' FAILED')
        console.error(`\n  ERROR: ${error.message}`)
        if (error.detail) console.error(`  detail: ${error.detail}`)
        console.error(`\n  in ${table}, rows ${i}-${i + slice.length}. Re-run to resume.\n`)
        await client.end()
        process.exit(1)
      }
    }

    done += slice.length
    process.stdout.write('.')
  }

  grand += done
  console.log(` ${done} rows${DRY_RUN ? ' (dry run)' : ''}`)
}

/**
 * Advance every sequence past the ids we just inserted.
 *
 * THIS IS NOT OPTIONAL, and leaving it out is a silent bug that only shows up
 * later. Copying rows carries their explicit `id` values across, but a
 * BIGSERIAL's sequence starts at 1 on the new database regardless. The table
 * looks perfect -- right rows, right ids -- and then the first INSERT tries to
 * generate id 1 and dies on the primary key.
 *
 * Found the hard way on 2026-09-28: the notification digest's idempotency test
 * failed in CI with
 *
 *     duplicate key value violates unique constraint "notification_log_pkey"
 *
 * hours after the migration looked complete and verified. Both sequence-backed
 * tables in this schema were affected.
 *
 * `setval(..., greatest(max(id), 1), true)` rather than `max(id) + 1`: setval
 * with is_called = true means the NEXT nextval() returns max+1, and greatest()
 * keeps it legal for an empty table, where max() is NULL and 0 is out of range.
 */
async function resyncSequences() {
  const { rows: seqs } = await client.query(`
    SELECT s.relname AS seq, t.relname AS tbl, a.attname AS col
      FROM pg_class s
      JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass
      JOIN pg_class t ON t.oid = d.refobjid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
     WHERE s.relkind = 'S' AND t.relnamespace = 'public'::regnamespace
     ORDER BY t.relname`)

  if (seqs.length === 0) return

  console.log('\n  resyncing sequences:')
  for (const s of seqs) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, $2),
                     GREATEST((SELECT COALESCE(MAX("${s.col}"), 0) FROM "${s.tbl}"), 1),
                     true)`,
      [s.tbl, s.col]
    )
    const { rows } = await client.query(`SELECT last_value FROM "${s.seq}"`)
    console.log(`    ${`${s.tbl}.${s.col}`.padEnd(30)} -> ${rows[0].last_value}`)
  }
}

if (!DRY_RUN) await resyncSequences()

await client.end()
console.log(`\n  ${grand} rows loaded${DRY_RUN ? ' (dry run — nothing written)' : ''}.\n`)
