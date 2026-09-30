/**
 * Send an announcement now, rather than waiting for the Tuesday digest.
 *
 * Dry run by default. Nothing leaves the building without --send, because the
 * one thing that cannot be undone here is a bulk email.
 *
 *   npx tsx --env-file=.env.local scripts/testing/send-announcement.mts
 *   npx tsx --env-file=.env.local scripts/testing/send-announcement.mts --only=you@example.com
 *   npx tsx --env-file=.env.local scripts/testing/send-announcement.mts --send
 *
 * --only sends the real message to one address and claims nobody, so the copy
 * can be read in a real inbox before the list gets it.
 */

import { currentAnnouncement } from '../../lib/notifications/announcement'
import { siteUrl } from '../../lib/seo/site'
import { sendAnnouncement } from '../../lib/notifications/send-announcement'
import { sendMail } from '../../lib/notifications/submission-emails'

const arg = (f: string) => process.argv.find((a) => a.startsWith(`--${f}=`))?.slice(f.length + 3)
const has = (f: string) => process.argv.includes(`--${f}`)

const id = arg('id')
const only = arg('only')
// siteUrl() rather than the raw env var: locally that is http://localhost:3000
// and a bulk email carrying a localhost link is worse than no email.
const origin = arg('origin') || siteUrl()

// Reach a queued entry by asking what would be live later, since the entries
// themselves are not exported.
let announcement = currentAnnouncement()
if (id && announcement?.id !== id) {
  for (let weeks = 1; weeks <= 40; weeks++) {
    const candidate = currentAnnouncement(new Date(Date.now() + weeks * 7 * 86400000))
    if (candidate?.id === id) {
      announcement = candidate
      break
    }
  }
}

if (!announcement) {
  console.error(id ? `No announcement with id ${id}.` : 'No announcement is live.')
  process.exit(1)
}

console.log(`announcement : ${announcement.id}`)
console.log(`subject      : ${announcement.title}`)
console.log(`cta          : ${announcement.ctaLabel} -> ${origin}${announcement.ctaPath}`)
console.log('')

if (only) {
  // One address, real message, no claim. Deliberately not routed through
  // sendAnnouncement: that claims recipients, and a preview must not consume
  // somebody's one-and-only copy of this announcement.
  const html = `<p>${announcement.title}</p><p>${announcement.body}</p><p><a href="${origin}${announcement.ctaPath}">${announcement.ctaLabel}</a></p><p style="color:#888;font-size:12px">Preview — the real send includes the greeting and unsubscribe footer.</p>`
  const res = await sendMail(only, {
    subject: `[preview] ${announcement.title}`,
    html,
    text: `${announcement.title}\n\n${announcement.body}\n\n${announcement.ctaLabel}: ${origin}${announcement.ctaPath}`,
  })
  console.log(res.sent ? `preview sent to ${only}` : `preview FAILED: ${res.reason}`)
  process.exit(res.sent ? 0 : 1)
}

const dryRun = !has('send')
const result = await sendAnnouncement(announcement, { dryRun, origin })

console.log(dryRun ? 'DRY RUN — nothing was sent' : 'SENT')
console.log(`  considered   ${result.considered}`)
console.log(`  skipped      ${result.skipped}   (no address, no unsubscribe token, or opted out)`)
console.log(`  already sent ${result.alreadySent}`)
console.log(`  ${dryRun ? 'would send' : 'sent      '}   ${result.sent}`)
console.log(`  failed       ${result.failed}`)
for (const e of result.errors.slice(0, 5)) console.log(`    ${e}`)

if (dryRun) console.log('\nRe-run with --send to actually send.')
process.exitCode = result.failed > 0 ? 1 : 0
