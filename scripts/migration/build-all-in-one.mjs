#!/usr/bin/env node
/**
 * Concatenate the bootstrap files listed in supabase/bootstrap/ORDER.txt into
 * a single ALL_IN_ONE.sql.
 *
 *     node scripts/migration/build-all-in-one.mjs
 *
 * The order is dependency-driven and neither alphabetical nor chronological,
 * so it lives in ORDER.txt with the reasoning next to the entries that need
 * it, rather than in a shell command someone has to reconstruct.
 *
 * Each file gets a banner naming it, which run-sql-file.mjs splits on so a
 * failure reports the file it came from instead of a character offset into
 * 150 KB.
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ORDER_FILE = 'supabase/bootstrap/ORDER.txt'
const OUT = 'supabase/bootstrap/ALL_IN_ONE.sql'

const files = fs
  .readFileSync(ORDER_FILE, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

const missing = files.filter((f) => !fs.existsSync(path.join(ROOT, f)))
if (missing.length) {
  console.error(`\n  ERROR  listed in ${ORDER_FILE} but not on disk:\n${missing.map((m) => `           ${m}`).join('\n')}\n`)
  process.exit(1)
}

// Statements that cannot run inside a transaction would break a concatenated
// file. Checked rather than assumed, because the failure mode is obscure.
for (const f of files) {
  const body = fs.readFileSync(path.join(ROOT, f), 'utf8')
  if (/CONCURRENTLY/i.test(body)) {
    console.error(`\n  ERROR  ${f} uses CREATE INDEX CONCURRENTLY, which cannot run in a transaction.\n`)
    process.exit(1)
  }
  const begins = (body.match(/^\s*BEGIN\s*;/gim) || []).length
  const commits = (body.match(/^\s*COMMIT\s*;/gim) || []).length
  if (begins !== commits) {
    console.error(`\n  ERROR  ${f} has ${begins} BEGIN and ${commits} COMMIT — unbalanced.\n`)
    process.exit(1)
  }
}

const today = new Date().toISOString().slice(0, 10)
const out = [
  '-- ============================================================================',
  '-- ARCYN FIND — complete schema for a NEW, EMPTY Supabase project.',
  '--',
  `-- Generated ${today} by scripts/migration/build-all-in-one.mjs from`,
  '-- supabase/bootstrap/ORDER.txt. Edit that list, not this file.',
  '--',
  '-- Paste the whole thing into the SQL editor and run it once, or apply it with',
  '--     node scripts/migration/run-sql-file.mjs "<conn>" supabase/bootstrap/ALL_IN_ONE.sql',
  '-- which reports failures per section rather than as an offset into 150 KB.',
  '--',
  '-- It creates NO DATA. Load that separately — see supabase/bootstrap/README.md.',
  '--',
  '-- Safe to re-run: every statement is CREATE ... IF NOT EXISTS or',
  '-- CREATE OR REPLACE.',
  '-- ============================================================================',
]

files.forEach((f, i) => {
  out.push(
    '',
    '',
    '-- ###########################################################################',
    `-- ## STEP ${String(i + 1).padStart(2, '0')} of ${files.length} — ${f}`,
    '-- ###########################################################################',
    '',
    fs.readFileSync(path.join(ROOT, f), 'utf8')
  )
})

fs.writeFileSync(OUT, out.join('\n'))

const bytes = fs.statSync(OUT).size
console.log(`  built ${OUT}`)
console.log(`  ${files.length} sections, ${Math.round(bytes / 1024)} KB`)
