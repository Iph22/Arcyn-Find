/**
 * Do the three submission emails render, and do they say the right thing?
 *
 * Pure -- renders only, sends nothing. Catches the failures that otherwise
 * surface as a broken message in somebody's inbox: an unescaped name, a link
 * built wrong, a reviewer email that forgot to carry the checks.
 *
 * Run: npx tsx scripts/testing/submission-emails.mts
 */

import {
  renderApprovedEmail,
  renderRejectedEmail,
  renderReviewEmail,
} from '../../lib/notifications/submission-emails'
import { screenSubmission } from '../../lib/submission-screening'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const ORIGIN = 'https://arcynfind.com'
const REVIEW_URL = `${ORIGIN}/review/abc123token`

const screening = await screenSubmission({
  name: 'Cursor',
  description: 'An AI-first code editor for pair programming with a model, with inline edits and codebase-aware chat.',
  url: 'https://cursor.com',
})

console.log('\nReviewer email')
const review = renderReviewEmail({
  submission: {
    name: 'Cursor',
    description: 'An AI-first code editor.',
    url: 'https://cursor.com',
    category: 'Code & Development',
    submittedBy: 'someone@example.com',
    imageUrl: null,
  },
  screening,
  reviewUrl: REVIEW_URL,
})
check('has a subject naming the tool', review.subject.includes('Cursor'), review.subject)
check('carries the score', review.subject.includes(String(screening.score)) || review.html.includes(String(screening.score)))
check('has an approve link', review.html.includes(`${REVIEW_URL}?intent=approve`))
check('has a reject link', review.html.includes(`${REVIEW_URL}?intent=reject`))
check('lists the checks', screening.checks.every((c) => review.html.includes(c.label)))
check('says nothing changes until confirmed', review.html.includes('nothing changes until you confirm'))
check('plain-text part carries both links', review.text.includes('intent=approve') && review.text.includes('intent=reject'))

console.log('\nEscaping')
const nasty = renderReviewEmail({
  submission: {
    name: '<script>alert(1)</script>',
    description: 'Tom & Jerry\'s "tool" <b>bold</b>',
    url: 'https://example.com/?a=1&b=2',
    category: null,
    submittedBy: null,
    imageUrl: null,
  },
  screening: null,
  reviewUrl: REVIEW_URL,
})
check('script tag is escaped', !nasty.html.includes('<script>alert(1)</script>'))
check('and is still readable', nasty.html.includes('&lt;script&gt;'))
check('ampersand escaped', nasty.html.includes('Tom &amp; Jerry'))

console.log('\nSubmitter emails')
const yes = renderApprovedEmail('Cursor', ORIGIN)
check('approved names the tool', yes.subject.includes('Cursor'), yes.subject)
check('approved links to the search', yes.html.includes('/browse?search=Cursor'))

const no = renderRejectedEmail('Cursor', ORIGIN)
check('rejected names the tool', no.subject.includes('Cursor'), no.subject)
check('rejected invites a reply', no.html.toLowerCase().includes('reply'))
// The screening detail is for the reviewer. Handing it to a submitter turns
// it into a list of checks to defeat.
check(
  'rejected does NOT itemise the checks',
  !screening.checks.some((c) => no.html.includes(c.label))
)

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
