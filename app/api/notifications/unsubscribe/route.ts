/**
 * One-click unsubscribe.
 *
 * Deliberately unauthenticated: this is opened from a mail client, where there
 * is no session and never will be. The token in the URL is the credential —
 * unguessable, per-user, and rotatable. Requiring a sign-in here is how an
 * unsubscribe link becomes a spam complaint instead.
 *
 * GET  — a person clicked the link; act, then render a confirmation.
 * POST — RFC 8058 One-Click, sent by Gmail/Outlook's native unsubscribe
 *        button. Must act without confirmation and answer 200.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { siteUrl } from '@/lib/seo/site'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Clear the digest flag for the holder of `token`.
 *
 * Reads the existing preferences and writes them back with one key changed.
 * `preferences` is a single JSONB blob holding onboarding answers, privacy
 * settings and the notification toggles, so writing a bare
 * `{ notify_digest: false }` would silently delete all of it.
 *
 * Only `notify_digest` is touched. The link lives in the digest, so it is the
 * digest the reader is asking to stop — quietly disabling follower and review
 * notifications too would be a surprise the next time those ship.
 */
async function unsubscribe(token: string): Promise<'ok' | 'not-found' | 'error'> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, preferences')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (error) {
    logger.error('[Unsubscribe] lookup failed:', error.message)
    return 'error'
  }
  if (!data) return 'not-found'

  const preferences = {
    ...((data.preferences as Record<string, unknown> | null) ?? {}),
    notify_digest: false,
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ preferences, updated_at: new Date().toISOString() })
    .eq('id', data.id)

  if (updateError) {
    logger.error('[Unsubscribe] update failed:', updateError.message)
    return 'error'
  }

  return 'ok'
}

/** Minimal self-contained confirmation page; no app shell, no client JS. */
function page(title: string, body: string, status: number): NextResponse {
  const origin = siteUrl()
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title}</title>
</head>
<body style="margin:0;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;">
  <div style="max-width:440px;margin:15vh auto;padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;">
    <h1 style="margin:0 0 10px;font-size:19px;color:#0f172a;">${title}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:21px;color:#475569;">${body}</p>
    <a href="${origin}/settings" style="font-size:14px;color:#2563eb;text-decoration:none;">Manage all notification settings &rarr;</a>
  </div>
</body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return page('Invalid link', 'This unsubscribe link is missing its token.', 400)

  const result = await unsubscribe(token)

  if (result === 'error') {
    return page(
      'Something went wrong',
      'We could not update your preferences just now. Please try again, or change them from your settings page.',
      500
    )
  }
  if (result === 'not-found') {
    // Deliberately not "no such token": an unsubscribe endpoint that confirms
    // which tokens are real is an account-enumeration oracle, and the outcome
    // the reader wants — no more digests — is true either way.
    return page(
      'You are unsubscribed',
      'You will no longer receive the Arcyn Find digest. If you keep receiving it, let us know.',
      200
    )
  }

  return page(
    'You are unsubscribed',
    'You will no longer receive the Arcyn Find digest. You can turn it back on any time from your settings.',
    200
  )
}

/**
 * RFC 8058 One-Click. The mail client expects a 200 and reads no body, so this
 * answers plainly and never redirects.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const result = await unsubscribe(token)
  if (result === 'error') {
    return NextResponse.json({ error: 'Could not unsubscribe' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
