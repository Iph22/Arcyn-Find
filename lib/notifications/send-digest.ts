import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase'
import { siteUrl } from '@/lib/seo/site'
import { logger } from '@/lib/logger'
import { buildDigestContent, type DigestContent } from './digest-content'
import { renderDigestHtml, renderDigestText } from './template'
import { isPushConfigured, sendPushToUsers } from './send-push'

/**
 * The digest sender.
 *
 * Runs from `/api/cron/send-digest` on a weekly schedule. The shape is dictated
 * by two constraints that pull against each other: a 60s function budget, and
 * a recipient list that grows without bound.
 *
 * It resolves them by being *resumable*. Recipients are claimed in
 * `notification_log` under a period key before anything is sent, so a run that
 * stops on the time budget leaves the rest unclaimed and the next run — the
 * same scheduled job, or a manual re-trigger after the failure alert fires —
 * picks up exactly where it left off, within the same period, without
 * re-mailing anyone.
 */

/** Resend's batch endpoint accepts at most 100 messages per call. */
const BATCH_SIZE = 100

/** Recipient page size. Well under PostgREST's silent 1000-row cap (§2). */
const PAGE_SIZE = 500

/**
 * Stop claiming new recipients past this point in the run.
 *
 * The route declares `maxDuration = 60`. Stopping at 45s leaves room for the
 * in-flight batch to resolve and for the log to be written, because a send
 * that completes without its log row being updated is the one case that can
 * produce a duplicate on the next run.
 */
const TIME_BUDGET_MS = 45_000

export interface DigestRunResult {
  digestKey: string
  /** Recipients this run claimed and attempted. */
  attempted: number
  sent: number
  failed: number
  /** Recipients skipped because they had opted out or had no address. */
  skipped: number
  /** True when the time budget stopped the run with recipients remaining. */
  budgetExhausted: boolean
  toolCount: number
  isNew: boolean
  elapsedMs: number
  /**
   * Browser-push counts, reported separately from email on purpose.
   *
   * Push is a bonus channel: most recipients have no subscription, and an
   * expired one is routine housekeeping rather than a fault. Folding these
   * into `sent`/`failed` would make the email numbers unreadable and could
   * trip the failure check below over something that is working correctly.
   */
  pushSent: number
  pushFailed: number
  pushExpired: number
}

/**
 * Whether a completed run should be reported to the schedule as a failure.
 *
 * Returns a reason, or null when the run was acceptable.
 *
 * This exists because "the function returned without throwing" and "people
 * received the digest" are different claims, and only the first was being
 * reported. Per-recipient rejections are caught and counted rather than
 * thrown, so a run in which Resend refused *every* address still returned a
 * result object and a 200 -- and `curl --fail` in the workflow only trips on
 * a non-2xx. A total delivery failure therefore produced a green run and no
 * alert, which is precisely how the trending cron failed 40 times before
 * anyone noticed.
 *
 * Two conditions, both meaning "nobody got mail and that is not normal":
 *
 *   - every attempted send failed. One bad address among many is tolerated
 *     and merely logged, because addresses come from OAuth providers and are
 *     not re-validated; losing *all* of them is a configuration fault
 *     (unverified domain, revoked key) and not self-correcting.
 *
 *   - the digest had no content. The publishable band holds ~2,900 rows, so
 *     an empty selection is never the catalog being quiet -- it is a schema
 *     change, a drifted popularity band or a broken query. A digest that
 *     silently stops going out looks exactly like one nobody opens.
 *
 * Having zero recipients is deliberately *not* a failure: that is the
 * expected state while addresses are still accumulating from sign-ins.
 */
export function digestRunFailureReason(result: DigestRunResult): string | null {
  if (result.toolCount === 0) {
    return 'no tools qualified for the digest; nothing could be sent'
  }
  if (result.attempted > 0 && result.failed === result.attempted) {
    return `every one of ${result.attempted} attempted send(s) failed`
  }
  return null
}

interface Recipient {
  id: string
  email: string
  displayName: string | null
  unsubscribeToken: string
}

/**
 * ISO-8601 week key, e.g. `2026-W38`.
 *
 * The period identity for idempotency. Derived from the run's wall clock, not
 * from per-user state, so every recipient of a given week shares one key and a
 * re-run inside that week is a no-op for anyone already mailed.
 */
export function isoWeekKey(date: Date): string {
  // Shift to Thursday of the same week: ISO weeks are numbered by the year
  // that owns their Thursday, which is what makes the year boundary correct.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNumber = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + 4 - dayNumber)

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)

  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Whether this profile's preferences permit a digest.
 *
 * Opt-out, not opt-in: a profile that has never touched the settings page has
 * no `preferences` at all, and the settings UI itself defaults
 * `emailNotifications` to on. Treating absence as consent is what makes the
 * defaults in that UI honest — a user who sees "Email Notifications: on" and
 * changes nothing has been told they will receive email.
 *
 * `notify_digest` is the digest's own switch, separate from the per-event
 * toggles, so unsubscribing from the digest does not silence a future
 * follower notification and vice versa.
 */
function wantsDigest(preferences: Record<string, unknown> | null): boolean {
  if (!preferences) return true
  if (preferences.email_notifications === false) return false
  if (preferences.notify_digest === false) return false
  return true
}

/**
 * One page of candidate recipients, keyset-paginated on `id`.
 *
 * Keyset rather than `.range()` offsets: §2 records deep offsets timing out at
 * ~87k rows on this database, and this table is not exempt.
 */
async function fetchRecipientPage(afterId: string | null): Promise<{
  recipients: Recipient[]
  skipped: number
  lastId: string | null
}> {
  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('user_profiles')
    .select('id, email, display_name, unsubscribe_token, preferences')
    .not('email', 'is', null)
    .order('id', { ascending: true })
    .limit(PAGE_SIZE)

  if (afterId) query = query.gt('id', afterId)

  const { data, error } = await query
  if (error) {
    throw new Error(`digest recipients (after=${afterId ?? 'start'}): ${error.message}`)
  }

  const rows = data ?? []
  const recipients: Recipient[] = []
  let skipped = 0

  for (const row of rows) {
    const email = typeof row.email === 'string' ? row.email.trim() : ''
    const token = typeof row.unsubscribe_token === 'string' ? row.unsubscribe_token : ''
    const prefs = (row.preferences as Record<string, unknown> | null) ?? null

    // No token means no unsubscribe link, and mailing someone without one is
    // not something to do on a best-effort basis. The migration backfills every
    // existing row and defaults new ones, so this is a genuine anomaly.
    if (!email || !token || !wantsDigest(prefs)) {
      skipped += 1
      continue
    }

    recipients.push({
      id: String(row.id),
      email,
      displayName: typeof row.display_name === 'string' ? row.display_name : null,
      unsubscribeToken: token,
    })
  }

  return {
    recipients,
    skipped,
    lastId: rows.length > 0 ? String(rows[rows.length - 1].id) : null,
  }
}

/**
 * Reserve recipients for this period.
 *
 * `ignoreDuplicates` makes this `INSERT ... ON CONFLICT DO NOTHING` against the
 * unique index on (user_id, kind, digest_key), and `.select()` returns only the
 * rows that were actually inserted — so the return value *is* the set of users
 * this run is responsible for. Anyone already mailed this period conflicts out
 * silently.
 *
 * The payload names every NOT NULL column without a default. §2: a partial
 * `.upsert()` payload generates an INSERT that fails NOT NULL constraints, and
 * this project has been bitten by that twice.
 *
 * Exported so `npm run test:digest` can exercise it directly. This is the one
 * thing standing between a retry and mailing the whole list twice, and it
 * cannot be verified by reading it -- `ignoreDuplicates` silently degrades to
 * an ordinary upsert if the unique index it depends on is not there.
 */
export async function claimRecipients(recipients: Recipient[], digestKey: string): Promise<Set<string>> {
  if (recipients.length === 0) return new Set()

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('notification_log')
    .upsert(
      recipients.map((r) => ({
        user_id: r.id,
        kind: 'digest',
        digest_key: digestKey,
        status: 'claimed',
      })),
      { onConflict: 'user_id,kind,digest_key', ignoreDuplicates: true }
    )
    .select('user_id')

  if (error) throw new Error(`claiming digest recipients: ${error.message}`)

  return new Set((data ?? []).map((row) => String(row.user_id)))
}

/** Record the outcome for a set of claimed recipients. */
async function resolveClaims(
  userIds: string[],
  digestKey: string,
  status: 'sent' | 'failed',
  detail: { messageId?: string; error?: string }
): Promise<void> {
  if (userIds.length === 0) return

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('notification_log')
    .update({
      status,
      message_id: detail.messageId ?? null,
      error: detail.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('kind', 'digest')
    .eq('digest_key', digestKey)
    .in('user_id', userIds)

  if (error) {
    // Not fatal: the mail is already sent or already failed, and the claim rows
    // still prevent a duplicate. Losing the status is an audit gap, not a
    // correctness problem, and failing the run here would be worse.
    logger.error('[Digest] could not resolve claims:', error.message)
  }
}

/** Advance the per-user watermark for the recipients that were mailed. */
async function markSent(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('user_profiles')
    .update({ last_digest_sent_at: new Date().toISOString() })
    .in('id', userIds)

  if (error) logger.error('[Digest] could not advance last_digest_sent_at:', error.message)
}

/**
 * The watermark for "new since last time".
 *
 * Global rather than per-user, and that is the load-bearing decision here: the
 * digest body is built once and mailed to everyone, so one query builds one
 * payload. Per-user content would mean one candidate query per recipient, which
 * does not fit the budget and would not survive a growing list.
 */
async function lastRunAt(): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('notification_log')
    .select('created_at')
    .eq('kind', 'digest')
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    logger.warn('[Digest] could not read last run, falling back to best-of:', error.message)
    return null
  }
  const row = (data ?? [])[0]
  return row ? String(row.created_at) : null
}

/** Send one batch, returning the ids that succeeded and the ones that did not. */
async function sendBatch(
  resend: Resend,
  batch: Recipient[],
  content: DigestContent,
  digestKey: string,
  origin: string,
  from: string
): Promise<{ sent: string[]; failed: string[]; error?: string }> {
  const payload = batch.map((recipient) => {
    const unsubscribeUrl = `${origin}/api/notifications/unsubscribe?token=${encodeURIComponent(recipient.unsubscribeToken)}`
    const input = {
      tools: content.tools,
      isNew: content.isNew,
      displayName: recipient.displayName,
      unsubscribeUrl,
      settingsUrl: `${origin}/settings`,
      siteUrl: origin,
    }

    return {
      from,
      to: [recipient.email],
      subject: content.isNew ? 'New AI tools on Arcyn Find' : 'AI tools worth a look',
      html: renderDigestHtml(input),
      text: renderDigestText(input),
      headers: {
        // Gmail and Outlook surface a native unsubscribe control from these,
        // which measurably reduces spam complaints against the sending domain.
        // One-Click requires the POST target to act without confirmation.
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }
  })

  try {
    const { data, error } = await resend.batch.send(payload, {
      // Scoped to the period and the batch contents, so a retried request
      // cannot produce a second send even if our own claim rows were lost.
      idempotencyKey: `digest-${digestKey}-${batch[0].id}-${batch.length}`,
      // One malformed address fails only its own message rather than the whole
      // batch — the addresses come from OAuth providers and are not re-validated.
      batchValidation: 'permissive',
    })

    if (error) {
      return { sent: [], failed: batch.map((r) => r.id), error: error.message }
    }

    // Under permissive validation the response carries per-index failures
    // alongside the created ids. The SDK types `errors` conditionally on the
    // literal type of `batchValidation`, which survives inference here but is
    // fragile to refactor, and its presence is really a runtime contract driven
    // by a request header -- so this reads it structurally and treats absence
    // as "nothing failed" rather than depending on that conditional resolving.
    const failedIndexes = new Set(
      ((data as unknown as { errors?: { index: number }[] } | null)?.errors ?? []).map((e) => e.index)
    )

    const sent: string[] = []
    const failed: string[] = []
    batch.forEach((recipient, index) => {
      if (failedIndexes.has(index)) failed.push(recipient.id)
      else sent.push(recipient.id)
    })

    return { sent, failed }
  } catch (cause) {
    return {
      sent: [],
      failed: batch.map((r) => r.id),
      error: cause instanceof Error ? cause.message : String(cause),
    }
  }
}

/**
 * Run the digest.
 *
 * Throws only on the failures that mean nothing can be sent at all — missing
 * configuration, or a content query that errored. Per-recipient failures are
 * recorded and counted, never thrown, so one bad address cannot abort a run.
 */
export async function sendDigest(now: Date = new Date()): Promise<DigestRunResult> {
  const startedAt = Date.now()
  const digestKey = isoWeekKey(now)

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')

  const from = `Arcyn Find <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`
  const origin = siteUrl()

  const content = await buildDigestContent(await lastRunAt(), origin)

  // An empty digest is a bug somewhere upstream, not a message. Sending a
  // header and a footer to the whole list would be worse than sending nothing,
  // and it would burn the period key so the fixed run could not go out.
  if (content.tools.length === 0) {
    logger.warn('[Digest] no tools qualified; nothing sent')
    return {
      digestKey,
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      budgetExhausted: false,
      pushSent: 0,
      pushFailed: 0,
      pushExpired: 0,
      toolCount: 0,
      isNew: content.isNew,
      elapsedMs: Date.now() - startedAt,
    }
  }

  const resend = new Resend(apiKey)

  let attempted = 0
  let pushSent = 0
  let pushFailed = 0
  let pushExpired = 0
  let sent = 0
  let failed = 0
  let skipped = 0
  let budgetExhausted = false
  let cursor: string | null = null

  // Bounded so a pagination bug cannot spin against the database forever; the
  // time budget is the real limit and trips long before this does.
  for (let page = 0; page < 200; page++) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      budgetExhausted = true
      break
    }

    const { recipients, skipped: pageSkipped, lastId } = await fetchRecipientPage(cursor)
    skipped += pageSkipped

    if (lastId === null) break
    cursor = lastId

    const claimedIds = await claimRecipients(recipients, digestKey)
    const claimed = recipients.filter((r) => claimedIds.has(r.id))

    for (let i = 0; i < claimed.length; i += BATCH_SIZE) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        budgetExhausted = true
        break
      }

      const batch = claimed.slice(i, i + BATCH_SIZE)
      attempted += batch.length

      const result = await sendBatch(resend, batch, content, digestKey, origin, from)
      sent += result.sent.length
      failed += result.failed.length

      await resolveClaims(result.sent, digestKey, 'sent', {})
      await markSent(result.sent)

      // Push the same digest to whichever browsers these recipients have
      // subscribed. Deliberately keyed off `result.sent` rather than the whole
      // batch: someone whose email bounced should not get a notification
      // pointing at a digest they never received.
      //
      // Push is a bonus channel, never a gate. Most recipients have no
      // subscription at all, its failures are counted separately, and nothing
      // here can fail the email run -- which is why it is awaited but its
      // result only feeds the log.
      if (result.sent.length > 0 && isPushConfigured()) {
        const push = await sendPushToUsers(result.sent, {
          title: content.isNew ? 'New AI tools on Arcyn Find' : 'AI tools worth a look',
          body: content.tools
            .slice(0, 3)
            .map((t) => t.name)
            .join(', ') + (content.tools.length > 3 ? ` and ${content.tools.length - 3} more` : ''),
          url: `${origin}/tools`,
        })
        pushSent += push.sent
        pushFailed += push.failed
        pushExpired += push.expired
      }

      if (result.failed.length > 0) {
        await resolveClaims(result.failed, digestKey, 'failed', {
          error: result.error ?? 'provider rejected this recipient',
        })
        logger.error(`[Digest] ${result.failed.length} failed: ${result.error ?? 'per-recipient rejection'}`)
      }
    }

    if (budgetExhausted) break
  }

  return {
    digestKey,
    attempted,
    sent,
    failed,
    skipped,
    budgetExhausted,
    toolCount: content.tools.length,
    isNew: content.isNew,
    elapsedMs: Date.now() - startedAt,
    pushSent,
    pushFailed,
    pushExpired,
  }
}
