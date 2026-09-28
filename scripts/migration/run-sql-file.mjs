#!/usr/bin/env node
/**
 * Run a .sql file against a Postgres connection, section by section.
 *
 *     node scripts/migration/run-sql-file.mjs "<connection-string>" supabase/bootstrap/ALL_IN_ONE.sql
 *     node scripts/migration/run-sql-file.mjs "<connection-string>" <file> --from=12
 *
 * ---------------------------------------------------------------------------
 * WHY NOT JUST PASTE IT INTO THE SQL EDITOR
 *
 * ALL_IN_ONE.sql is 150 KB across 26 sections. Pasted as one blob, a failure
 * reports a character offset into the whole script, and finding which of the
 * 26 files that lands in is a manual hunt. Splitting on the section banners
 * means an error names the file it came from.
 *
 * Sections are executed in order, each as its own statement batch. That is
 * equivalent to running the files individually -- which is what the banners
 * were generated from -- because each file that opens a transaction also
 * closes it.
 *
 * --from=N resumes at section N, so a fix does not mean re-running the
 * sections that already succeeded. Everything in the bootstrap is
 * CREATE ... IF NOT EXISTS or CREATE OR REPLACE, so re-running is harmless
 * either way.
 *
 * Use the SESSION POOLER connection string (port 5432), not the direct
 * connection: direct is IPv6-only on current projects.
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let Client
try {
  ;({ Client } = require('pg'))
} catch {
  console.error('\n  ERROR  `pg` is not installed.  npm i pg --no-save\n')
  process.exit(1)
}

const [DB_URL, FILE] = process.argv.slice(2)
const FROM = Number(process.argv.find((a) => a.startsWith('--from='))?.split('=')[1] ?? 1)

if (!DB_URL?.startsWith('postgres') || !FILE) {
  console.error('\n  usage: node scripts/migration/run-sql-file.mjs "<connection-string>" <file.sql> [--from=N]\n')
  process.exit(1)
}
if (!fs.existsSync(FILE)) {
  console.error(`\n  ERROR  no such file: ${FILE}\n`)
  process.exit(1)
}

const sql = fs.readFileSync(FILE, 'utf8')

// Split on the banners ALL_IN_ONE.sql writes. A file without them runs whole,
// as a single section, which is the right behaviour for any other .sql file.
const BANNER = /^-- ## STEP (\d+) of \d+ — (.+)$/gm
const marks = [...sql.matchAll(BANNER)]

const sections = marks.length
  ? marks.map((m, i) => ({
      n: Number(m[1]),
      name: m[2].trim(),
      body: sql.slice(m.index, marks[i + 1]?.index ?? sql.length),
    }))
  : [{ n: 1, name: FILE, body: sql }]

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  // Index builds on empty tables are fast, but the vector index and the larger
  // function bodies are not instant. Generous rather than clever.
  statement_timeout: 300_000,
})

process.stdout.write('  connecting... ')
try {
  await client.connect()
  console.log('ok\n')
} catch (error) {
  const ipv6 = error.code === 'ENOTFOUND' && /^db\./.test(new URL(DB_URL).hostname)
  console.error(
    `\n  ERROR  ${error.message}\n\n         ` +
      (ipv6
        ? 'That is the DIRECT connection, which is IPv6-only. Use the session\n         pooler: Connect (top bar) -> Session pooler, port 5432.'
        : 'Check the connection string. Session pooler, port 5432.') +
      '\n'
  )
  process.exit(1)
}

let ran = 0
for (const section of sections) {
  if (section.n < FROM) {
    console.log(`  ${String(section.n).padStart(2)}. ${section.name.padEnd(52)} skipped (--from=${FROM})`)
    continue
  }

  process.stdout.write(`  ${String(section.n).padStart(2)}. ${section.name.padEnd(52)}`)
  try {
    await client.query(section.body)
    ran++
    console.log('ok')
  } catch (error) {
    console.log('FAILED')
    console.error(`\n  ${error.severity ?? 'ERROR'}: ${error.message}`)
    if (error.detail) console.error(`  detail: ${error.detail}`)
    if (error.hint) console.error(`  hint:   ${error.hint}`)
    if (error.where) console.error(`  where:  ${String(error.where).split('\n')[0]}`)

    // Locate the failing statement within the section, so the report points at
    // a line in a real file rather than an offset into a 150 KB blob.
    if (error.position) {
      const upto = section.body.slice(0, Number(error.position))
      const line = upto.split('\n').length
      console.error(`  at:     ${section.name}, roughly line ${line} of that section`)
      console.error(`\n  ${upto.split('\n').slice(-1)[0].trim().slice(0, 120)}`)
    }
    console.error(
      `\n  Nothing after section ${section.n} was run. Fix it, then resume:\n` +
        `      node scripts/migration/run-sql-file.mjs "<conn>" ${FILE} --from=${section.n}\n`
    )
    await client.end()
    process.exit(1)
  }
}

await client.end()
console.log(`\n  ${ran} section${ran === 1 ? '' : 's'} applied cleanly.\n`)
