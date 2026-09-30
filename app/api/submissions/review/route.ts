import { NextResponse } from 'next/server'

import { applyReview, type ReviewAction } from '@/lib/submission-review'
import {
  renderApprovedEmail,
  renderRejectedEmail,
  sendMail,
} from '@/lib/notifications/submission-emails'
import { siteUrl } from '@/lib/seo/site'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * POST /api/submissions/review
 *
 * The write half of reviewing by email. The link in the message is a GET that
 * only renders -- see lib/submission-review.ts for why -- and this is what the
 * button on that page calls.
 *
 * The token is the authorisation. There is no session to check: the reviewer
 * is reading mail, not signed in. It is single-use and cleared inside the same
 * conditional update that sets the status, so a double tap, a retry, or a
 * scanner racing the reviewer all resolve to exactly one decision.
 */
export async function POST(request: Request) {
  let body: { token?: unknown; action?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token : ''
  const action = body.action === 'approve' || body.action === 'reject' ? (body.action as ReviewAction) : null
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : undefined

  if (!token || !action) {
    return NextResponse.json({ error: 'A token and an action are required.' }, { status: 400 })
  }

  const outcome = await applyReview(token, action, note)

  // Null means the token matched nothing. Deliberately the same answer for a
  // forged token and a spent one -- distinguishing them tells a guesser which
  // guesses were close.
  if (!outcome) {
    return NextResponse.json(
      { error: 'This review link is no longer valid. It may already have been used.' },
      { status: 404 }
    )
  }

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error ?? 'Could not apply that decision.' }, { status: 409 })
  }

  // Tell the submitter, in both directions. Best-effort: the decision is
  // already recorded and re-running it is impossible, so a failed email must
  // not turn a completed review into an error.
  const to = outcome.submission.submitted_by
  if (to) {
    const origin = siteUrl()
    const message =
      action === 'approve'
        ? renderApprovedEmail(outcome.submission.name, origin)
        : renderRejectedEmail(outcome.submission.name, origin)
    const result = await sendMail(to, message)
    if (!result.sent) {
      logger.warn(`[Review] decision recorded but submitter was not emailed: ${result.reason}`)
    }
  }

  return NextResponse.json({
    ok: true,
    action,
    name: outcome.submission.name,
    published: Boolean(outcome.publishedId),
    notifiedSubmitter: Boolean(to),
  })
}
