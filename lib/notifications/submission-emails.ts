/**
 * The three messages a submission produces.
 *
 *   1. to the reviewer  — "someone submitted this, here is what we found"
 *   2. to the submitter — "it is live"
 *   3. to the submitter — "it was not accepted"
 *
 * Every one of these is best-effort. A submission that was stored but whose
 * notification failed is a submission, not an error: the row is in
 * tool_submissions either way and the reviewer can find it. Failing the
 * request because an email bounced would lose the submission to protect the
 * notification, which is backwards.
 */

import { Resend } from 'resend'

import type { Screening } from '../submission-screening'

const BRAND = '#6d5efc'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px">
    <p style="margin:0 0 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#71717a">Arcyn Find</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>
    ${body}
  </div>
</body></html>`
}

function statusDot(status: string): string {
  const colour = status === 'pass' ? '#16a34a' : status === 'fail' ? '#dc2626' : '#a1a1aa'
  const glyph = status === 'pass' ? '&#10003;' : status === 'fail' ? '&#10007;' : '&#8213;'
  return `<span style="color:${colour};font-weight:700">${glyph}</span>`
}

export interface ReviewEmailInput {
  submission: {
    name: string
    description: string
    url: string
    category: string | null
    submittedBy: string | null
    imageUrl: string | null
  }
  screening: Screening | null
  /** `${origin}/review/${token}` */
  reviewUrl: string
}

/** What lands in the reviewer's inbox. */
export function renderReviewEmail(input: ReviewEmailInput): { subject: string; html: string; text: string } {
  const { submission, screening, reviewUrl } = input
  const score = screening?.score ?? null
  const blocking = screening?.blocking ?? []

  const checkRows = (screening?.checks ?? [])
    .map(
      (c) =>
        `<tr><td style="padding:4px 10px 4px 0;vertical-align:top">${statusDot(c.status)}</td>
         <td style="padding:4px 0;font-size:14px">${escapeHtml(c.label)}<br>
         <span style="color:#71717a;font-size:12px">${escapeHtml(c.detail)}</span></td></tr>`
    )
    .join('')

  const blockingHtml = blocking.length
    ? `<div style="margin:0 0 18px;padding:12px 14px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:6px">
         <strong style="font-size:13px;color:#b91c1c">Blocking</strong>
         <ul style="margin:6px 0 0;padding-left:18px;font-size:13px;color:#7f1d1d">
           ${blocking.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
         </ul>
       </div>`
    : ''

  const imageHtml = submission.imageUrl
    ? `<img src="${escapeHtml(submission.imageUrl)}" alt="" style="max-width:120px;max-height:120px;border-radius:10px;border:1px solid #e4e4e7;margin:0 0 16px">`
    : ''

  const body = `
    ${imageHtml}
    <p style="margin:0 0 4px;font-size:16px"><strong>${escapeHtml(submission.name)}</strong>${
      score !== null ? ` <span style="color:#71717a;font-size:13px">— screened ${score}/100</span>` : ''
    }</p>
    <p style="margin:0 0 6px;font-size:13px"><a href="${escapeHtml(submission.url)}" style="color:${BRAND}">${escapeHtml(submission.url)}</a></p>
    <p style="margin:0 0 16px;font-size:14px;color:#3f3f46">${escapeHtml(submission.description)}</p>
    <p style="margin:0 0 18px;font-size:12px;color:#71717a">
      ${escapeHtml(submission.category || 'Other')}${submission.submittedBy ? ` · from ${escapeHtml(submission.submittedBy)}` : ''}
    </p>
    ${blockingHtml}
    <table style="width:100%;border-collapse:collapse;margin:0 0 22px">${checkRows}</table>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr>
      <td style="padding-right:10px">
        <a href="${escapeHtml(reviewUrl)}?intent=approve" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600">Approve</a>
      </td>
      <td>
        <a href="${escapeHtml(reviewUrl)}?intent=reject" style="display:inline-block;background:#fff;color:#3f3f46;text-decoration:none;padding:10px 21px;border:1px solid #d4d4d8;border-radius:8px;font-size:14px;font-weight:600">Don't approve</a>
      </td>
    </tr></table>
    <p style="margin:0;font-size:12px;color:#a1a1aa">
      Both buttons open a page showing this tool; nothing changes until you confirm there.
      The link works once.
    </p>`

  const text = [
    `${submission.name}${score !== null ? ` — screened ${score}/100` : ''}`,
    submission.url,
    '',
    submission.description,
    '',
    ...(blocking.length ? ['BLOCKING:', ...blocking.map((b) => `  - ${b}`), ''] : []),
    ...(screening?.checks ?? []).map((c) => `  [${c.status}] ${c.label} — ${c.detail}`),
    '',
    `Approve:       ${reviewUrl}?intent=approve`,
    `Don't approve: ${reviewUrl}?intent=reject`,
    '',
    'Both open a confirmation page. Nothing changes until you confirm. The link works once.',
  ].join('\n')

  return {
    subject: `Review: ${submission.name}${blocking.length ? ' (blocking issues)' : score !== null ? ` — ${score}/100` : ''}`,
    html: shell(`New tool submitted`, body),
    text,
  }
}

export function renderApprovedEmail(name: string, origin: string): { subject: string; html: string; text: string } {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
      <strong>${escapeHtml(name)}</strong> has been added to the Arcyn Find directory. Thank you for
      submitting it — it is searchable now.
    </p>
    <a href="${escapeHtml(origin)}/discover?search=${encodeURIComponent(name)}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600">See it on Arcyn Find</a>`
  return {
    subject: `${name} is live on Arcyn Find`,
    html: shell('Your submission was accepted', body),
    text: `${name} has been added to the Arcyn Find directory and is searchable now.\n\n${origin}/discover?search=${encodeURIComponent(name)}`,
  }
}

export function renderRejectedEmail(name: string, origin: string): { subject: string; html: string; text: string } {
  // Deliberately does not itemise why. The screening detail is for the
  // reviewer; handing it to a submitter turns it into a list of checks to
  // defeat, and most rejections are judgement rather than a failed check.
  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
      Thank you for submitting <strong>${escapeHtml(name)}</strong>. We are not adding it to the
      directory at this time.
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46">
      This is not a judgement on the tool itself — the directory is curated, and a listing has to be
      something we can stand behind. If you think this was a mistake, reply to this email and tell us
      what we missed.
    </p>
    <a href="${escapeHtml(origin)}/submit" style="display:inline-block;background:#fff;color:#3f3f46;text-decoration:none;padding:10px 21px;border:1px solid #d4d4d8;border-radius:8px;font-size:14px;font-weight:600">Submit another tool</a>`
  return {
    subject: `About your submission: ${name}`,
    html: shell('Your submission was not accepted', body),
    text: `Thank you for submitting ${name}. We are not adding it to the directory at this time.\n\nThe directory is curated, and a listing has to be something we can stand behind. If you think this was a mistake, reply and tell us what we missed.\n\n${origin}/submit`,
  }
}

/**
 * Send one message. Never throws.
 *
 * Returns whether it went, so a caller can log the difference between "not
 * configured" and "refused" without either becoming a failed request.
 */
export async function sendMail(
  to: string,
  message: { subject: string; html: string; text: string }
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY is not configured' }

  const from = `Arcyn Find <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`
  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
    return error ? { sent: false, reason: error.message } : { sent: true }
  } catch (error) {
    return { sent: false, reason: (error as Error).message }
  }
}
