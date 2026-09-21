import webpush from 'web-push'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * Web push delivery.
 *
 * The counterpart to the email sender, sharing its recipients but almost none
 * of its mechanics. Two differences drive the design:
 *
 *   - A subscription belongs to a *browser*, not a person. One user may have
 *     three; a user with none is the normal state, not a failure.
 *   - Subscriptions rot. Clearing site data, reinstalling, or simply not
 *     opening the browser for weeks invalidates them, and the push service
 *     answers 404/410. That is not an error to retry, it is a row to delete.
 *
 * Payloads are encrypted per subscription, so there is no batch endpoint —
 * each send is its own request. That is fine at this scale and is the reason
 * the caller passes a wall-clock budget.
 */

/** Shape `sw.js` expects: it reads `title`, `body`, and `url` for the click. */
export interface PushPayload {
  title: string
  body: string
  url: string
}

export interface PushSendResult {
  attempted: number
  sent: number
  /** Subscriptions the push service reported as gone; these were deleted. */
  expired: number
  /** Real failures: network, encryption, misconfiguration. */
  failed: number
}

interface SubscriptionRow {
  id: number
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Whether push is configured at all.
 *
 * Exported so callers can skip the work and say so, rather than treating an
 * unconfigured deployment as a delivery failure and opening an alert issue
 * every week for something nobody has set up yet.
 */
export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
}

function configure(): void {
  webpush.setVapidDetails(
    // RFC 8292 requires a contact the push service can reach if a sender
    // misbehaves. A wrong value here is accepted at send time and only shows up
    // as unexplained throttling later, so it is explicit rather than derived.
    process.env.VAPID_SUBJECT || 'mailto:arcynflow@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  )
}

/** Delete subscriptions the push service has told us are gone. */
async function dropExpired(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('push_subscriptions').delete().in('id', ids)
  if (error) {
    // Not fatal. A stale row costs one wasted request next run and will be
    // reported gone again; failing the send over it would be worse.
    logger.error('[Push] could not delete expired subscriptions:', error.message)
  }
}

/**
 * Push one payload to every subscription belonging to `userIds`.
 *
 * Never throws for a single bad subscription. Returns counts so the caller can
 * decide what to report; `expired` is deliberately separate from `failed`
 * because an expired subscription is routine housekeeping while a failure is
 * usually configuration.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  budgetMs = 15_000
): Promise<PushSendResult> {
  const result: PushSendResult = { attempted: 0, sent: 0, expired: 0, failed: 0 }
  if (userIds.length === 0 || !isPushConfigured()) return result

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (error) {
    logger.error('[Push] could not read subscriptions:', error.message)
    return result
  }

  const subs = (data ?? []) as SubscriptionRow[]
  if (subs.length === 0) return result

  configure()
  const body = JSON.stringify(payload)
  const startedAt = Date.now()
  const expiredIds: number[] = []
  const usedIds: number[] = []

  // Serial in small groups: each payload is encrypted separately so there is no
  // batch endpoint, and firing hundreds at once is how you get rate limited by
  // a push service that has no interest in your schedule.
  for (let i = 0; i < subs.length; i += 10) {
    if (Date.now() - startedAt > budgetMs) {
      logger.warn('[Push] stopped on the time budget with subscriptions remaining')
      break
    }

    await Promise.all(
      subs.slice(i, i + 10).map(async (sub) => {
        result.attempted += 1
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          )
          result.sent += 1
          usedIds.push(sub.id)
        } catch (cause) {
          const status = (cause as { statusCode?: number })?.statusCode
          // 404 Not Found / 410 Gone: the browser threw the subscription away.
          // Expected, and the only correct response is to forget it too.
          if (status === 404 || status === 410) {
            result.expired += 1
            expiredIds.push(sub.id)
          } else {
            result.failed += 1
            logger.error(`[Push] send failed (status=${status ?? 'none'}):`,
              cause instanceof Error ? cause.message : String(cause))
          }
        }
      })
    )
  }

  await dropExpired(expiredIds)

  if (usedIds.length > 0) {
    const { error: touchError } = await supabase
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .in('id', usedIds)
    // Diagnostics only: a subscription that has never recorded a success is
    // how a broken VAPID configuration becomes visible.
    if (touchError) logger.error('[Push] could not stamp last_used_at:', touchError.message)
  }

  return result
}
