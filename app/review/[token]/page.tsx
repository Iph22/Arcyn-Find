import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { findByReviewToken } from '@/lib/submission-review'
import { ReviewDecision } from '@/components/review/review-decision'

export const dynamic = 'force-dynamic'

// A URL that carries a working credential must never be indexed, cached or
// sent onward in a Referer.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ intent?: string }>
}

/**
 * The page an approve/reject link in the reviewer email opens.
 *
 * It renders. It does not decide. Mail clients and security scanners follow
 * links in mail -- Gmail, Outlook Safe Links, most corporate filters -- so
 * anything that acted on GET would be fired by a scanner before the reviewer
 * read the message. The decision is a POST from the button below.
 *
 * The `intent` in the query only preselects which button is emphasised, so
 * tapping "Approve" in the email lands on a page already pointed at approval.
 * It carries no authority of its own.
 */
export default async function ReviewPage({ params, searchParams }: Props) {
  const { token } = await params
  const { intent } = await searchParams

  const submission = await findByReviewToken(token)
  if (!submission) notFound()

  return (
    <ReviewDecision
      token={token}
      intent={intent === 'reject' ? 'reject' : 'approve'}
      submission={{
        name: submission.name,
        description: submission.description,
        url: submission.url,
        category: submission.category,
        imageUrl: submission.image_url,
        submittedBy: submission.submitted_by,
        status: submission.status,
        submittedAt: submission.submitted_at,
      }}
      screening={submission.screening}
    />
  )
}
