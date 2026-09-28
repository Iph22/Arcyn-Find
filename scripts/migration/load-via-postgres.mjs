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

await client.end()
console.log(`\n  ${grand} rows loaded${DRY_RUN ? ' (dry run — nothing written)' : ''}.\n`)
