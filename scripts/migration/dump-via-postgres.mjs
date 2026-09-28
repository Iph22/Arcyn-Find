#!/usr/bin/env node
/**
 * Dump every public table to local JSON, over a DIRECT Postgres connection.
 *
 *     npm i pg --no-save
 *     node scripts/migration/dump-via-postgres.mjs "postgresql://postgres.<ref>:<pw>@<host>:5432/postgres"
 *
 * Writes ./migration-dump/<table>.json plus a manifest.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * On 2026-09-28 the source project was restricted for exceeding its egress
 * quota. Every path through Supabase's API gateway returns 402 -- REST, RPC,
 * Storage and Auth alike -- so transfer-to-new-project.mjs, which reads through
 * PostgREST, cannot get a single row out.
 *
 * The restriction is applied at the GATEWAY, not at Postgres. A direct
 * connection on port 5432 goes around it. That is the whole idea here.
 *
 * WHY NOT pg_dump / supabase db dump
 *
 * `supabase db dump` shells out to pg_dump, which is not on PATH on this
 * machine, and the CLI runs it inside Docker, which is not installed either.
 * `pg` is pure JavaScript with no native dependencies, so it needs neither.
 *
 * WHERE TO GET THE CONNECTION STRING
 *
 * The `Connect` button in the dashboard's TOP BAR, next to the branch name --
 * NOT Settings -> Database, which no longer shows one.
 *
 * Pick SESSION POOLER, not "Direct connection" and not transaction pooler:
 *
 *   Session pooler      aws-0-<region>.pooler.supabase.com:5432   <- this one
 *   Direct connection   db.<ref>.supabase.co:5432                 IPv6 only
 *   Transaction pooler  ...:6543                                  no cursors
 *
 * Direct connections are IPv6-only on current projects, which fails outright
 * on most home networks. The session pooler is IPv4-compatible and holds a
 * connection open across statements, which is what this script's paging needs;
 * transaction pooling does not, and reports "Tenant or user not found".
 *
 * The password is NOT the service role key. It is the database password, on
 * that same page -- reset it there if you never saved it.
 *
 * Wrap the URL in quotes. It contains characters your shell will otherwise
 * interpret, and if the password has any, percent-encode them.
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let Client
try {
  ;({ Client } = require('pg'))
} catch {
  console.error('\n  ERROR  The `pg` package is not installed.\n         npm i pg --no-save\n')
  process.exit(1)
}

const DB_URL = process.argv[2]
const OUT_DIR = process.argv[3] || 'migration-dump'

if (!DB_URL || !DB_URL.startsWith('postgres')) {
  console.error(
    '\n  usage: node scripts/migration/dump-via-postgres.mjs "<connection-string>" [out-dir]\n\n' +
      '  Supabase dashboard -> Settings -> Database -> Connection string -> URI\n' +
      '  Use session mode (port 5432). Quote the string.\n'
  )
  process.exit(1)
}

/** Caches and derived tables. Nothing here is worth carrying to a new project. */
const SKIP = new Set(['search_cache', 'catalog_stats'])

/**
 * Rows per SELECT.
 *
 * Deliberately modest. A restricted project is already unhappy, and the point
 * is to get the data out reliably rather than quickly -- a statement timeout
 * halfway through a 15,000-row table wastes more time than paging does.
 */
const PAGE = 500

const client = new Client({
  connectionString: DB_URL,
  // Supabase terminates TLS with a certificate this client will not chain to a
  // local root store. The connection is still encrypted; we are declining to
  // verify the chain, which is the documented way to connect from a script.
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120_000,
})

function human(bytes) {
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

try {
  process.stdout.write('  connecting... ')
  await client.connect()
  console.log('ok\n')
} catch (error) {
  console.error(
    `\n  ERROR  could not connect: ${error.message}\n\n` +
      '         If this says "Tenant or user not found", the URL is the pooler in\n' +
      '         transaction mode -- switch to session mode (port 5432).\n' +
      '         If it times out, the direct connection may be blocked too; then the\n' +
      '         only routes left are the dashboard SQL editor or a month of Pro.\n'
  )
  process.exit(1)
}

// Real tables only. Views (user_stats) recompute from the tables that feed
// them, and dumping one would produce rows that cannot be inserted anywhere.
const { rows: tables } = await client.query(`
  SELECT table_name
    FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
   ORDER BY table_name
`)

fs.mkdirSync(OUT_DIR, { recursive: true })

const manifest = []
let grandTotal = 0
let grandBytes = 0

for (const { table_name: table } of tables) {
  if (SKIP.has(table)) {
    console.log(`  ${table.padEnd(26)} skipped (cache)`)
    continue
  }

  process.stdout.write(`  ${table.padEnd(26)}`)

  // Order by the primary key so paging is stable. Tables without one fall back
  // to ctid, which is not stable across writes but is fine for a cold dump.
  const { rows: pk } = await client.query(
    `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary`,
    [table]
  )
  const orderBy = pk.length ? pk.map((c) => `"${c.attname}"`).join(', ') : 'ctid'

  const all = []
  for (let offset = 0; ; offset += PAGE) {
    const { rows } = await client.query(
      `SELECT * FROM "${table}" ORDER BY ${orderBy} LIMIT ${PAGE} OFFSET ${offset}`
    )
    if (rows.length === 0) break
    all.push(...rows)
    process.stdout.write('.')
    if (rows.length < PAGE) break
  }

  const file = path.join(OUT_DIR, `${table}.json`)
  const json = JSON.stringify(all)
  fs.writeFileSync(file, json)

  const bytes = Buffer.byteLength(json)
  grandTotal += all.length
  grandBytes += bytes
  manifest.push({ table, rows: all.length, bytes, primaryKey: pk.map((c) => c.attname) })

  console.log(` ${String(all.length).padStart(6)} rows  ${human(bytes)}`)
}

fs.writeFileSync(
  path.join(OUT_DIR, '_manifest.json'),
  JSON.stringify({ dumpedAt: new Date().toISOString(), tables: manifest }, null, 2)
)

await client.end()

console.log(`\n  ${grandTotal} rows, ${human(grandBytes)} written to ${OUT_DIR}/`)
console.log(`  manifest: ${OUT_DIR}/_manifest.json`)
console.log('\n  Next: run supabase/bootstrap/ against the new project, then')
console.log('        node --env-file=.env.local scripts/migration/transfer-to-new-project.mjs \\')
console.log(`          --from-dir=${OUT_DIR}\n`)
