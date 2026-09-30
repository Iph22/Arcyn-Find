/**
 * Approving or rejecting a submission from a link in an email.
 *
 * WHY THE LINK IS THE CREDENTIAL
 *
 * There is no admin page to sign in to, so the token in the URL is the only
 * thing standing between a stranger and the live catalog. It is 32 random
 * bytes, single-use, and cleared the moment it is spent -- a replayed link
 * finds nothing and says so rather than quietly re-running.
 *
 * WHY THE EMAIL LINK DOES NOT ITSELF APPROVE
 *
 * Mail clients and security filters follow links in mail. Gmail, Outlook Safe
 * Links and most corporate scanners fetch every URL in a message, often
 * before the recipient has opened it. A GET that approved a submission would
 * therefore be fired by a scanner, and the first approvals would happen with
 * nobody having read anything.
 *
 * So the emailed URL renders a page and writes nothing. The page carries the
 * action the link intended, and one button POSTs it. Two taps rather than
 * one, and the second tap is in front of the tool's own details.
 */

import { randomBytes } from 'crypto'

import { getSupabaseAdmin } from './supabase'
import type { Screening } from './submission-screening'
import { slugify } from './seo/slug'
import { updateToolEmbedding } from './embeddings'

export type ReviewAction = 'approve' | 'reject'

export interface SubmissionRow {
  id: string
  name: string
  description: string
  url: string
  category: string | null
  pricing: string | null
  access_type: string | null
  tags: string[] | null
  image_url: string | null
  submitted_by: string | null
  status: string
  screening: Screening | null
  screening_score: number | null
  submitted_at: string
}

/** 32 bytes, url-safe. Long enough that guessing is not a strategy. */
export function createReviewToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * The submission a review link refers to, or null.
 *
 * Null covers three cases that are indistinguishable to a caller on purpose --
 * wrong token, already-reviewed submission, spent link -- because telling them
 * apart tells an attacker which tokens exist.
 */
export async function findByReviewToken(token: string): Promise<SubmissionRow | null> {
  if (!token || token.length < 20) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tool_submissions')
    .select(
      'id, name, description, url, category, pricing, access_type, tags, image_url, submitted_by, status, screening, screening_score, submitted_at'
    )
    .eq('review_token', token)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as SubmissionRow
}

export interface ReviewOutcome {
  ok: boolean
  action: ReviewAction
  submission: SubmissionRow
  /** Set when approval put a row into ai_tools. */
  publishedId?: string
  error?: string
}

/**
 * Apply a decision.
 *
 * The token is cleared in the same update that sets the status, and that
 * update is conditioned on the row still being pending. Two taps on the same
 * link -- or a tap racing a scanner -- therefore resolve to one write: the
 * second matches no row and reports the link as spent.
 */
export async function applyReview(
  token: string,
  action: ReviewAction,
  reviewerNote?: string
): Promise<ReviewOutcome | null> {
  const submission = await findByReviewToken(token)
  if (!submission) return null
  if (submission.status !== 'pending') {
    return { ok: false, action, submission, error: `Already ${submission.status}.` }
  }

  const supabase = getSupabaseAdmin()

  // Claim the submission first. If this matches nothing, somebody -- or
  // something -- got here first.
  const { data: claimed, error: claimError } = await supabase
    .from('tool_submissions')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      review_token: null,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewerNote ?? null,
    })
    .eq('id', submission.id)
    .eq('status', 'pending')
    .select('id')

  if (claimError) {
    return { ok: false, action, submission, error: claimError.message }
  }
  if (!claimed || claimed.length === 0) {
    return { ok: false, action, submission, error: 'This link has already been used.' }
  }

  if (action === 'reject') {
    return { ok: true, action, submission }
  }

  // Approved: put it in the catalog.
  //
  // popularity 50 deliberately. PUBLISH_MIN_POPULARITY is 75, so a submitted
  // tool is listed and searchable but does not get a public SEO page on
  // somebody else's say-so. Raising it is a separate, deliberate act.
  const publishedId = `submitted-${slugify(submission.name).slice(0, 50)}-${Date.now()}`
  const { error: insertError } = await supabase.from('ai_tools').insert({
    id: publishedId,
    name: submission.name,
    description: submission.description,
    platform: submission.url,
    category: submission.category || 'Other',
    pricing: submission.pricing || 'Unknown',
    access_type: submission.access_type || 'Unknown',
    tags: submission.tags || [],
    image: submission.image_url,
    popularity: 50,
    region: 'Global',
    // NOT NULL with no default, and every published row carries the same
    // literal 'unknown' -- a legacy column nothing reads. Omitting it is what
    // made the first approval fail, which is precisely the partial-payload
    // NOT NULL trap this table is known for. Match the corpus rather than
    // invent a value that would make this row the only one of its kind.
    status: 'unknown',
    last_updated: new Date().toISOString().split('T')[0],
    is_trending: false,
  })

  if (insertError) {
    // The submission is already marked approved and its token is spent, so
    // this cannot be retried from the link. Say so plainly rather than
    // reporting a success that did not happen -- the row is recoverable by
    // hand from tool_submissions, a silent failure is not.
    return {
      ok: false,
      action,
      submission,
      error: `Marked approved, but publishing failed: ${insertError.message}. The submission is in tool_submissions and can be added by hand.`,
    }
  }

  // Embed it, or it is published but not findable.
  //
  // Search leads with semantic matching, and a row with a NULL embedding
  // cannot match that way at all -- it only survives on full text. Measured
  // on the first approved tool: searching its exact name "Granola" returned
  // Leftovers AI, AI Recipe Generator and Oatmealhealth, because those have
  // embeddings and the cereal is a better vector match for the word than the
  // product is. The tool existed, had a page, and could not be found by name.
  //
  // One embedding against a quota of 1000/day, and awaited rather than fired
  // and forgotten so the reviewer's "published" is true when they read it.
  // A failure here is logged and does not undo the approval: an unfindable
  // tool is recoverable by the backfill, an un-approved one is not.
  try {
    const embedded = await updateToolEmbedding(publishedId)
    if (!embedded) {
      console.warn(`[Review] ${publishedId} published without an embedding; the backfill will pick it up.`)
    }
  } catch (error) {
    console.warn(`[Review] embedding ${publishedId} failed: ${(error as Error).message}`)
  }

  return { ok: true, action, submission, publishedId }
}
