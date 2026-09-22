// How much of the site is actually untranslated, and are the locales in sync?
//
//   npm run i18n:audit
//
// Two questions, because they fail differently:
//
//   1. Untranslated English literals. Visible immediately to anyone who
//      switches language, so it gets found eventually either way.
//   2. Locale key parity. A key present in `en` and missing elsewhere does
//      NOT fail anything -- `t()` falls back to English, the page renders,
//      CI stays green, and that locale is quietly half-translated. Nothing
//      else in this repo catches that.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const DIRS = ['app', 'components']

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

// Leading character is [A-Za-z0-9], not [A-Z]: numbered legal headings like
// "5. Data Security" start with a digit, and requiring a capital made this
// report a page as fully translated while five sections were still English.
//
// The ceiling is 200, not 80. Long sentences are exactly what legal and
// explanatory copy is made of, and an 80-character cap hid all of it.
const TEXT = />\s*([A-Za-z0-9][A-Za-z0-9 ,.'&:!?()/-]{4,200})\s*</g
const ATTR = /\b(placeholder|title|aria-label|alt|label)="([A-Z][^"]{3,200})"/g
const TOAST = /toast\.(success|error|info|warning|message)\(\s*["'`]([^"'`]{4,200})/g

const rows = []
let totalText = 0
let totalAttr = 0
let totalToast = 0

for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, 'utf8')
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    const isClient = /^["']use client["']/m.test(src)
    const hasHook = src.includes('useLanguage')

    const text = [...src.matchAll(TEXT)]
      .map((m) => m[1].trim())
      .filter((s) => !/^[A-Z][a-z]*$/.test(s) || s.length > 6)
      // Widening the leading character to [A-Za-z0-9] let JSX guards in,
      // e.g. `{items.length > 0 && (` matches as the text "0 && (".
      // Require a real word and reject anything carrying JS operators.
      .filter((s) => /[A-Za-z]{2}/.test(s) && !/&&|\|\||=>|[{}]/.test(s))
    const attr = [...src.matchAll(ATTR)].map((m) => m[2])
    const toasts = [...src.matchAll(TOAST)].map((m) => m[2])

    const n = text.length + attr.length + toasts.length
    if (n === 0) continue
    totalText += text.length
    totalAttr += attr.length
    totalToast += toasts.length
    rows.push({ rel, isClient, hasHook, n })
  }
}

rows.sort((a, b) => b.n - a.n)
const client = rows.filter((r) => r.isClient)
const server = rows.filter((r) => !r.isClient)

console.log('UNTRANSLATED USER-VISIBLE STRINGS')
console.log('')
console.log(`  text nodes        ${String(totalText).padStart(5)}`)
console.log(`  attributes        ${String(totalAttr).padStart(5)}`)
console.log(`  toast messages    ${String(totalToast).padStart(5)}`)
console.log(`  TOTAL             ${String(totalText + totalAttr + totalToast).padStart(5)}`)
console.log('')
console.log(`  files with strings      ${rows.length}`)
console.log(`    client components     ${client.length}  (reachable by useLanguage)`)
console.log(`    server components     ${server.length}  (NOT reachable -- useLanguage is a client hook)`)
console.log('')
console.log('TOP 15 FILES')
for (const r of rows.slice(0, 15)) {
  console.log(`  ${String(r.n).padStart(4)}  ${r.isClient ? 'client' : 'SERVER'}  ${r.rel}${r.hasHook ? ' [wired]' : ''}`)
}

// ---------------------------------------------------------------------------
// Locale key parity
// ---------------------------------------------------------------------------
//
// Counts every key on a line rather than assuming one per line: the later
// language blocks pack several onto one line, and a naive line count reports
// eight locales as missing thirty keys when nothing is actually wrong.
const ctx = readFileSync(join(ROOT, 'contexts', 'language-context.tsx'), 'utf8')
const ctxLines = ctx.split('\n')
const blocks = {}

for (let i = 0; i < ctxLines.length; i++) {
  const open = ctxLines[i].match(/^ {2}([a-z]{2}): \{\s*$/)
  if (!open) continue
  const code = open[1]
  const keys = new Set()
  for (i++; i < ctxLines.length && !/^ {2}\},\s*$/.test(ctxLines[i]); i++) {
    for (const m of ctxLines[i].matchAll(/"([a-zA-Z0-9._]+)":/g)) keys.add(m[1])
  }
  blocks[code] = keys
}

const codes = Object.keys(blocks)
if (codes.length > 0) {
  const en = blocks.en ?? new Set()
  const gaps = []
  for (const code of codes) {
    const missing = [...en].filter((k) => !blocks[code].has(k))
    const extra = [...blocks[code]].filter((k) => !en.has(k))
    if (missing.length > 0 || extra.length > 0) gaps.push({ code, missing, extra })
  }

  console.log('')
  console.log('LOCALE KEY PARITY')
  console.log(`  locales: ${codes.length} | keys in en: ${en.size}`)
  if (gaps.length === 0) {
    console.log('  ok - every locale defines exactly the same keys')
  } else {
    for (const g of gaps) {
      console.log(`  ${g.code}: missing ${g.missing.length}, extra ${g.extra.length}`)
      if (g.missing.length > 0) console.log(`      missing: ${g.missing.slice(0, 5).join(', ')}`)
      if (g.extra.length > 0) console.log(`      extra:   ${g.extra.slice(0, 5).join(', ')}`)
    }
    // Non-zero exit so this can gate CI: a half-translated locale is invisible
    // to every other check in the repo.
    process.exitCode = 1
  }
}
