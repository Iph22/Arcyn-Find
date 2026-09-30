/**
 * Can the digest carry an announcement right now, or not until next Tuesday?
 *
 * The digest claims each recipient once per ISO week in notification_log, so
 * triggering a run inside a week that has already been sent mails nobody --
 * it finds every recipient claimed and exits clean. That is correct behaviour
 * and it is also the reason "send it now" is not simply a matter of firing the
 * cron by hand.
 *
 * Read-only. Run with --env-file=.env.local
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

/** Same shape the digest uses: ISO-8601 week, Monday-based. */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const now = new Date()
console.log(`today            ${now.toISOString().slice(0, 10)} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getUTCDay()]})`)
console.log(`this week's key  ${isoWeekKey(now)}`)

const { count: recipients } = await db
  .from('user_profiles')
  .select('*', { count: 'exact', head: true })
  .not('email', 'is', null)
console.log(`profiles with an email   ${recipients ?? 0}`)

const { data: log, error } = await db
  .from('notification_log')
  .select('kind, digest_key, status, created_at')
  .order('created_at', { ascending: false })
  .limit(200)

if (error) {
  console.log(`\nnotification_log: ${error.message}`)
} else {
  const rows = log ?? []
  const byPeriod = new Map<string, number>()
  for (const r of rows) { const k = String(r.kind) + ' / ' + String(r.digest_key); byPeriod.set(k, (byPeriod.get(k) ?? 0) + 1) }
  console.log('\nrecent digest periods (most recent 200 rows):')
  if (!byPeriod.size) console.log('  (none — no digest has ever claimed a recipient)')
  for (const [k, n] of byPeriod) console.log(`  ${k}  ${n} claim(s)`)

  const claimedThisWeek = byPeriod.get('digest / ' + isoWeekKey(now)) ?? 0
  console.log(
    claimedThisWeek > 0
      ? `\nThis week is already claimed (${claimedThisWeek}). Triggering the digest now would mail nobody.`
      : '\nThis week is unclaimed. Triggering the digest now WOULD send.'
  )
}
