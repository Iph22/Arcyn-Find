/**
 * A short product note carried by the weekly digest.
 *
 * WHY THIS RIDES THE DIGEST RATHER THAN BEING ITS OWN SEND. There is exactly
 * one bulk email path in this codebase, and it is `send-digest.ts`: it holds
 * the opt-out check, the unsubscribe token requirement, the List-Unsubscribe
 * headers, the batching, and the `notification_log` claim that stops a
 * resumed run mailing anyone twice. A separate announcement sender would have
 * to reproduce all of that correctly to be safe, and would ask people to
 * accept a second class of email they never opted into. Reusing the digest
 * costs one block of copy and inherits every one of those guarantees.
 *
 * WHY IT EXPIRES ON ITS OWN. An announcement that has to be deleted by hand
 * is still in the digest six months later, because the person who would
 * delete it has moved on and nothing fails when they don't. `until` is the
 * whole mechanism: past that date `currentAnnouncement()` returns null and
 * the digest silently goes back to being only a digest. Nothing to remember.
 *
 * It is deliberately NOT a database table. One row of copy that changes a few
 * times a year belongs in the repository, where it is reviewed, typed, and
 * deployed like anything else -- and where it cannot be edited into an
 * outbound email without a commit.
 */

export interface Announcement {
  /** Stable id, for logs. Not shown to anyone. */
  id: string
  title: string
  /** One or two sentences. This sits above someone's actual digest. */
  body: string
  ctaLabel: string
  /** Site-relative, joined with the origin by the caller. Never absolute. */
  ctaPath: string
  /**
   * Last day this appears, inclusive, as `YYYY-MM-DD` UTC.
   *
   * The digest is weekly, so this is measured in digest runs rather than in
   * days: three weeks is three sends, which catches someone who skipped a
   * week without becoming wallpaper for someone who didn't.
   */
  until: string
  /**
   * The browser-push version, which retires earlier than the email does.
   *
   * Two windows on purpose. An email is something people scan and skip; a
   * push is an interruption, and the same interruption three weeks running is
   * how someone decides to turn push off for good. So the note stays in the
   * digest for its full run and the push fires once, on the first weekly send
   * inside `pushUntil`.
   *
   * Copy is separate too, not truncated from `title`/`body`: push surfaces cut
   * hard and at different lengths per platform, so it is written short rather
   * than clipped mid-sentence.
   */
  push: { title: string; body: string; pushUntil: string }
}

const ANNOUNCEMENTS: readonly Announcement[] = [
  {
    id: 'compare-2026-09',
    title: 'New: compare tools side by side',
    body:
      'Pick up to four tools while you browse and see them next to each other — ' +
      'pricing, free tiers, platform and what they actually do. Every comparison ' +
      'has its own link, so you can send one to someone else.',
    ctaLabel: 'Try comparing',
    // Bare /compare, not /browse. It is the feature's own page and its empty
    // state explains the flow and links onward to the directory; /browse would
    // drop the reader into a tool list with no hint of why they are there.
    ctaPath: '/compare',
    until: '2026-10-20',
    push: {
      title: 'Compare tools side by side',
      body: 'Put up to four AI tools next to each other on price, free tier and features.',
      // The 2026-10-06 run, and only that one.
      //
      // This date has to be picked against the cron, not by counting days
      // from today. The digest fires Tuesdays 09:00 UTC
      // (.github/workflows/cron-notification-digest.yml), and the 2026-09-29
      // run had already gone out before this landed -- so the next three
      // sends are 10-06, 10-13 and 10-20. An earlier-looking `2026-10-05`
      // reads like "about a week" and would have closed the window before a
      // single run touched it: the push would silently never have fired, and
      // nothing would have failed to say so.
      pushUntil: '2026-10-06',
    },
  },
  // ORDER IS THE SCHEDULE. currentAnnouncement() returns the first unexpired
  // entry, so this one waits behind `compare-2026-09` and takes over when that
  // expires on 2026-10-20 -- the 10-27, 11-03 and 11-10 sends.
  //
  // Deliberately placed second rather than first. The compare note has not
  // gone out once yet: it landed after the 09-29 run, so its first send is
  // 10-06. Putting this ahead of it would retire a feature announcement that
  // nobody has ever seen, to announce a different feature.
  //
  // Move this above compare only if the submission flow matters more than
  // compare being announced at all, and shorten compare's `until` at the same
  // time so the dead entry does not sit there looking scheduled.
  {
    id: 'submissions-2026-10',
    title: "What's new: add a tool, and search that waits for you",
    body:
      'You can now submit a tool we are missing — we check the site, review it by ' +
      'hand and email you either way. Search also waits for you to finish typing ' +
      'now instead of firing off mid-sentence, and every result has its own page ' +
      'you can link to.',
    ctaLabel: 'Submit a tool',
    // /submit, which now asks people to sign in first and says why. That is
    // the page the note is about; /browse would bury the actual invitation.
    ctaPath: '/submit',
    // Three sends: 2026-10-27, 11-03, 11-10.
    until: '2026-11-10',
    push: {
      title: 'Add a tool to Arcyn Find',
      body: 'Submit an AI tool we are missing. Every one is reviewed by hand and you hear back either way.',
      // The 2026-10-27 run, and only that one. Counted against the Tuesday
      // cron rather than from today, for the reason the entry above records.
      pushUntil: '2026-10-27',
    },
  },
]

/**
 * The announcement to carry right now, or null.
 *
 * Returns the first unexpired entry: the list is expected to hold zero or one
 * live item at a time, and stacking two notices above someone's digest is not
 * a thing this should make easy.
 *
 * Compared as `YYYY-MM-DD` strings in UTC, which sorts correctly and avoids
 * the timezone question entirely -- the digest cron runs in UTC and an
 * announcement expiring a few hours early or late on the last day does not
 * matter.
 */
export function currentAnnouncement(now: Date = new Date()): Announcement | null {
  const today = now.toISOString().slice(0, 10)
  return ANNOUNCEMENTS.find((a) => today <= a.until) ?? null
}

/**
 * Whether this announcement should also take over the digest's push.
 *
 * Take over, not add to: the alternative was a second push in the same run,
 * which doubles the interruption for the people who were most willing to hear
 * from us. The email in that same run still carries both the announcement and
 * the full tool selection, so nothing is lost -- only the one-line nudge
 * changes what it points at for a single week.
 */
export function announcementPushActive(
  announcement: Announcement | null,
  now: Date = new Date()
): boolean {
  if (!announcement) return false
  return now.toISOString().slice(0, 10) <= announcement.push.pushUntil
}
