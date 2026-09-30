/**
 * Render the digest email carrying an announcement, to a file you can open.
 *
 * Announcements ride the weekly digest rather than being their own send -- see
 * the note at the top of lib/notifications/announcement.ts -- so the only
 * honest preview is the digest with the note in it. A block of copy read on
 * its own always reads better than the same block sitting above somebody's
 * actual tool list.
 *
 * Sends nothing. Writes two HTML files and prints the schedule the entry will
 * actually follow, which is the part that is easy to get wrong: the digest
 * fires Tuesdays 09:00 UTC, so a window is measured in sends, not in days.
 *
 * Run: npx tsx scripts/testing/preview-announcement.mts [--id=submissions-2026-10]
 */

import { writeFileSync } from 'fs'
import { resolve } from 'path'

import { renderDigestHtml, renderDigestText } from '../../lib/notifications/template'
import { currentAnnouncement } from '../../lib/notifications/announcement'

const wantedId = process.argv.find((a) => a.startsWith('--id='))?.slice(5)

// Reach past currentAnnouncement() when a specific entry is asked for, so a
// queued note can be read before the one ahead of it expires.
const mod = (await import('../../lib/notifications/announcement')) as unknown as {
  currentAnnouncement: typeof currentAnnouncement
}

/**
 * Which announcement each upcoming digest run would actually carry.
 *
 * Not "every Tuesday inside this entry's window" -- that is the mistake this
 * function exists to avoid. currentAnnouncement() returns the FIRST unexpired
 * entry, so an entry can sit inside its own window for weeks while a different
 * one is being sent. Asking the real function per date is the only answer that
 * matches what people will receive.
 */
function schedule(weeks = 12): { date: string; id: string | null }[] {
  const out: { date: string; id: string | null }[] = []
  const cursor = new Date()
  cursor.setUTCHours(9, 0, 0, 0)
  for (let i = 0; i < weeks * 7 && out.length < weeks; i++) {
    if (cursor.getUTCDay() === 2 && cursor.getTime() > Date.now()) {
      out.push({
        date: cursor.toISOString().slice(0, 10),
        id: mod.currentAnnouncement(new Date(cursor))?.id ?? null,
      })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

const live = mod.currentAnnouncement()

// The entries themselves are not exported, so pick the one to preview by
// asking for a date past everything ahead of it.
let chosen = live
if (wantedId && live?.id !== wantedId) {
  for (let weeks = 1; weeks <= 30; weeks++) {
    const future = new Date(Date.now() + weeks * 7 * 86400000)
    const candidate = mod.currentAnnouncement(future)
    if (candidate?.id === wantedId) {
      chosen = candidate
      break
    }
  }
}

if (!chosen) {
  console.error(wantedId ? `No announcement with id ${wantedId}.` : 'No live announcement.')
  process.exit(1)
}

console.log(`Announcement: ${chosen.id}`)
console.log(`  title : ${chosen.title}`)
console.log(`  body  : ${chosen.body}`)
console.log(`  cta   : ${chosen.ctaLabel} -> ${chosen.ctaPath}`)
console.log(`  email until : ${chosen.until}`)
console.log(`  push  until : ${chosen.push.pushUntil}`)

const runs = schedule()
console.log('\n  what each upcoming digest run would actually carry:')
for (const r of runs) {
  const mark = r.id === chosen.id ? '  <-- this one' : ''
  console.log(`    ${r.date}  ${r.id ?? '(no announcement)'}${mark}`)
}

const mine = runs.filter((r) => r.id === chosen.id)
console.log(
  mine.length
    ? `\n  ${chosen.id} sends on: ${mine.map((r) => r.date).join(', ')}`
    : `\n  ${chosen.id} NEVER SENDS in the next 12 weeks -- an earlier entry covers its whole window`
)

// The push rides the first run inside its own window that also carries this
// announcement, so both conditions have to hold on the same date.
const pushDate = mine.find((r) => r.date <= chosen.push.pushUntil)
console.log(`  push fires on: ${pushDate ? pushDate.date : 'NEVER -- pushUntil closes before this note is the live one'}`)

const sample = {
  displayName: 'Dave',
  unsubscribeUrl: 'https://arcynfind.com/api/notifications/unsubscribe?token=SAMPLE',
  origin: 'https://arcynfind.com',
  announcement: {
    title: chosen.title,
    body: chosen.body,
    ctaLabel: chosen.ctaLabel,
    ctaUrl: `https://arcynfind.com${chosen.ctaPath}`,
  },
  tools: [
    { name: 'Cursor', description: 'AI-first code editor with codebase-aware chat.', url: 'https://arcynfind.com/tools/cursor', category: 'Code & Development' },
    { name: 'Leonardo.ai', description: 'Image generation with fine-grained style control.', url: 'https://arcynfind.com/tools/leonardo-ai', category: 'Image Generation' },
    { name: 'ElevenLabs', description: 'Speech synthesis and voice cloning.', url: 'https://arcynfind.com/tools/elevenlabs', category: 'Audio & Music' },
  ],
}

try {
  const html = renderDigestHtml(sample as never)
  const text = renderDigestText(sample as never)
  const outDir = process.env.TEMP || process.env.TMPDIR || process.cwd()
  const htmlPath = resolve(outDir, `announcement-preview-${chosen.id}.html`)
  const textPath = resolve(outDir, `announcement-preview-${chosen.id}.txt`)
  writeFileSync(htmlPath, html, 'utf8')
  writeFileSync(textPath, text, 'utf8')
  console.log(`\nwrote ${htmlPath}`)
  console.log(`wrote ${textPath}`)
  console.log('\nOpen the .html in a browser.')
} catch (error) {
  console.error(`\ncould not render the digest template: ${(error as Error).message}`)
  console.error('The copy above is still what would be sent.')
}
