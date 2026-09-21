/**
 * Repair user text stored while the validators escaped on input.
 *
 *   npm run unescape:legacy        # dry run, prints every change
 *   npm run unescape:legacy -- --execute
 *
 * `safeString`, `safeDisplayName` and `safeBio` used to end in
 * `.transform(sanitizeHtml)`, so anything a user typed was HTML-escaped before
 * it reached the database. React escapes on render, so those rows display the
 * entity rather than the character — "It&#x27;s an amazing tool" is what a
 * reader actually sees on the reviews page.
 *
 * The validators now store text as typed and escape at the point of HTML
 * interpolation instead. This fixes the rows written under the old rule.
 *
 * Only ever unescapes ONE level, because that is exactly how many the old
 * transform applied. Every before/after pair is printed so the change is
 * reversible by inspection.
 */
import { createClient } from '@supabase/supabase-js'

const EXECUTE = process.argv.includes('--execute')

// Same entity table as lib/security/input-validator.ts. Kept in sync by the
// contact e2e check, which asserts the round trip against the real functions.
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

function unescapeHtml(input) {
  if (!input || typeof input !== 'string') return input
  let output = input
  for (const [char, entity] of Object.entries(HTML_ENTITIES)) {
    if (char === '&') continue
    output = output.split(entity).join(char)
  }
  return output.split(HTML_ENTITIES['&']).join('&')
}

// Every column fed by safeString / safeDisplayName / safeBio.
const TARGETS = [
  { table: 'tool_reviews', key: 'id', columns: ['title', 'review_text'] },
  { table: 'collections', key: 'id', columns: ['name', 'description'] },
  { table: 'user_profiles', key: 'id', columns: ['display_name', 'bio'] },
]

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log(EXECUTE ? 'MODE: execute (writes)\n' : 'MODE: dry run (no writes) — pass --execute to apply\n')

let totalRows = 0
let totalCols = 0
let failures = 0

for (const target of TARGETS) {
  const select = [target.key, ...target.columns].join(', ')

  // Narrow filter, small tables: an OR of LIKEs over a handful of rows, not
  // the pattern docs/CORPUS_AND_CONSTRAINTS.md warns about on ai_tools.
  const orFilter = target.columns.map((c) => `${c}.like.%&#x%`).join(',')
  const { data, error } = await supabase.from(target.table).select(select).or(orFilter)

  if (error) {
    if (error.message?.includes('does not exist')) {
      console.log(`${target.table}: table or column missing, skipped`)
      continue
    }
    console.log(`${target.table}: ERROR ${error.message}`)
    failures++
    continue
  }

  if (!data || data.length === 0) {
    console.log(`${target.table}: nothing to repair`)
    continue
  }

  for (const row of data) {
    const patch = {}
    for (const column of target.columns) {
      const before = row[column]
      if (typeof before !== 'string') continue
      const after = unescapeHtml(before)
      if (after !== before) {
        patch[column] = after
        console.log(`\n${target.table}.${column}  [${row[target.key]}]`)
        console.log(`  before: ${JSON.stringify(before)}`)
        console.log(`  after : ${JSON.stringify(after)}`)
        totalCols++
      }
    }

    if (Object.keys(patch).length === 0) continue
    totalRows++

    if (EXECUTE) {
      const { error: updateError } = await supabase
        .from(target.table)
        .update(patch)
        .eq(target.key, row[target.key])
      if (updateError) {
        console.log(`  !! update failed: ${updateError.message}`)
        failures++
      } else {
        console.log('  applied')
      }
    }
  }
}

console.log(
  `\n${EXECUTE ? 'Updated' : 'Would update'} ${totalCols} column(s) across ${totalRows} row(s).` +
    (failures ? ` ${failures} failure(s).` : '')
)
process.exit(failures === 0 ? 0 : 1)
