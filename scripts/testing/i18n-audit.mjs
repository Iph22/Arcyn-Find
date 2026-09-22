// How much of the site is actually untranslated?
//
// Counts user-visible English literals in app/ and components/, and separates
// client components (which can use the current context) from server components
// (which cannot -- useLanguage is a client hook, so a server-rendered string is
// unreachable by the existing approach no matter how many keys we add).
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

// Visible text nodes and user-facing attributes. Deliberately conservative:
// requires a capital letter and a couple of words, so class names, ids and
// single symbols do not inflate the number.
const TEXT = />\s*([A-Z][A-Za-z0-9 ,.'&:!?()/-]{4,80})\s*</g
const ATTR = /\b(placeholder|title|aria-label|alt|label)="([A-Z][^"]{3,80})"/g
const TOAST = /toast\.(success|error|info|warning|message)\(\s*["'`]([^"'`]{4,120})/g

const rows = []
let totalText = 0, totalAttr = 0, totalToast = 0

for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, 'utf8')
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    const isClient = /^["']use client["']/m.test(src)
    const hasHook = src.includes('useLanguage')

    const text = [...src.matchAll(TEXT)].map((m) => m[1].trim())
      .filter((s) => !/^[A-Z][a-z]*$/.test(s) || s.length > 6)
    const attr = [...src.matchAll(ATTR)].map((m) => m[2])
    const toasts = [...src.matchAll(TOAST)].map((m) => m[2])

    const n = text.length + attr.length + toasts.length
    if (n === 0) continue
    totalText += text.length; totalAttr += attr.length; totalToast += toasts.length
    rows.push({ rel, isClient, hasHook, n, text: text.length, attr: attr.length, toast: toasts.length })
  }
}

rows.sort((a, b) => b.n - a.n)

const client = rows.filter((r) => r.isClient)
const server = rows.filter((r) => !r.isClient)
const wired = rows.filter((r) => r.hasHook)

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
console.log(`    already wired to t()  ${wired.length}`)
console.log('')
console.log('TOP 20 FILES BY UNTRANSLATED STRINGS')
for (const r of rows.slice(0, 20)) {
  const kind = r.isClient ? 'client' : 'SERVER'
  const w = r.hasHook ? ' [wired]' : ''
  console.log(`  ${String(r.n).padStart(4)}  ${kind}  ${r.rel}${w}`)
}
console.log('')
console.log('SERVER COMPONENTS WITH STRINGS (blocked by the current architecture)')
for (const r of server.slice(0, 12)) console.log(`  ${String(r.n).padStart(4)}  ${r.rel}`)
console.log(`  ... ${server.length} files, ${server.reduce((s, r) => s + r.n, 0)} strings total`)
