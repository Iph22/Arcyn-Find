/**
 * Store and remove this browser's push subscription.
 *
 * Authenticated, unlike the unsubscribe route: a subscription is written
 * against the signed-in user's id, so the session is what decides whose
 * notifications this browser receives. Accepting a user id from the body
 * would let anyone subscribe their own browser to someone else's alerts.
 *
 * POST   — save (or refresh) the subscription for the current user
 * DELETE — forget it, on turning the toggle off
 */

import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Shape produced by `PushSubscription.toJSON()`. */
interface SubscriptionBody {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)

    const body = (await request.json()) as SubscriptionBody
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
    const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
    const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''

    // All three are required to encrypt a payload. A row missing any of them is
    // one the sender can never use, so it is rejected here rather than stored
    // and failed against later.
    if (!endpoint || !p256dh || !auth) {
      return createErrorResponse(
        'A push subscription needs endpoint, keys.p256dh and keys.auth',
        400,
        ErrorCodes.VALIDATION_ERROR
      )
    }

    // Only accept real push service URLs. The endpoint is later handed to
    // web-push as a request target, so an unvalidated value here is a
    // server-side request forgery primitive.
    let parsed: URL
    try {
      parsed = new URL(endpoint)
    } catch {
      return createErrorResponse('Malformed endpoint', 400, ErrorCodes.VALIDATION_ERROR)
    }
    if (parsed.protocol !== 'https:') {
      return createErrorResponse('Endpoint must be https', 400, ErrorCodes.VALIDATION_ERROR)
    }

    const supabase = getSupabaseAdmin()

    // Conflict on `endpoint`, not on (user, endpoint): the endpoint identifies
    // a browser, and a shared machine where a second person signs in must
    // reassign that browser rather than leave both users pushing to it.
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

    if (error) throw error

    return createSuccessResponse({ message: 'Subscribed' })
  } catch (error) {
    logger.error('[PushSubscription] save failed:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to save subscription',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)

    const body = (await request.json().catch(() => ({}))) as SubscriptionBody
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''

    const supabase = getSupabaseAdmin()
    let query = supabase.from('push_subscriptions').delete().eq('user_id', user.id)

    // Scoped to the one endpoint when the client knows it, so turning the
    // toggle off on a laptop does not silently unsubscribe the same account's
    // phone. With no endpoint -- the browser had already discarded the
    // subscription -- clear every row this user has, which is the only way to
    // recover from orphaned state.
    if (endpoint) query = query.eq('endpoint', endpoint)

    const { error } = await query
    if (error) throw error

    return createSuccessResponse({ message: 'Unsubscribed' })
  } catch (error) {
    logger.error('[PushSubscription] delete failed:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to remove subscription',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
