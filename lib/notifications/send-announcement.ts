/**
 * Send an announcement to everyone opted in, once, now.
 *
 * WHY THIS EXISTS WHEN announcement.ts ARGUES AGAINST IT
 *
 * That module's case for riding the digest is that a separate sender "would
 * have to reproduce" the opt-out check, the unsubscribe-token requirement, the
 * List-Unsubscribe headers, the batching and the idempotency claim -- and
 * would probably get one of them wrong. That argument is about duplication,
 * not about the existence of a second path, so this module shares those parts
 * instead of reproducing them: `wantsDigest` and `claimRecipients` are
 * imported from send-digest.ts, not reimplemented here.
 *
 * What it buys is timing. The digest runs Tuesdays and claims each recipient
 * once per ISO week, so firing the cron inside a week that has already been
 * sent mails nobody -- correctly. A feature that shipped on a Wednesday
 * therefore cannot be announced until the following Tuesday at the earliest,
 * and only then if it is the first unexpired entry in the list.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not invent a new audience. The recipients are exactly the people who
 * would receive a digest: an address, an unsubscribe token, and `notify_digest`
 * not turned off. Someone who opted out of the digest has opted out of us
 * emailing them about the product, and a note titled "what's new" is not a
 * different category of thing.
 *
 * The claim uses kind 'announcement' with the announcement's own id as the
 * key, so: each person gets each announcement at most once, ever; a retried or
 * resumed run cannot double-send; and none of it touches the digest's weekly
 * slot.
 */

import { Resend } from 'resend'

import { getSupabaseAdmin } from '../supabase'
import { siteUrl } from '../seo/site'
import { claimRecipients, wantsDigest } from './send-digest'
import type { Announcement } from './announcement'

const PAGE_SIZE = 500
const BATCH_SIZE = 100

export interface AnnouncementRunResult {
  announcementId: string
  considered: number
  skipped: number
  alreadySent: number
  sent: number
  failed: number
  dryRun: boolean
  errors: string[]
}

interface Target {
  id: string
  email: string
  displayName: string | null
  unsubscribeToken: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function render(
  announcement: Announcement,
  target: Target,
  origin: string
): { subject: string; html: string; text: string; unsubscribeUrl: string } {
  const unsubscribeUrl = `${origin}/api/notifications/unsubscribe?token=${encodeURIComponent(target.unsubscribeToken)}`
  const ctaUrl = `${origin}${announcement.ctaPath}`
  const greeting = target.displayName ? `Hi ${escapeHtml(target.displayName)},` : 'Hi,'

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px">
    <p style="margin:0 0 20px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#71717a">Arcyn Find</p>
    <p style="margin:0 0 14px;font-size:15px">${greeting}</p>
    <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3">${escapeHtml(announcement.title)}</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#3f3f46">${escapeHtml(announcement.body)}</p>
    <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#6d5efc;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:15px;font-weight:600">${escapeHtml(announcement.ctaLabel)}</a>
    <hr style="margin:28px 0 16px;border:none;border-top:1px solid #e4e4e7">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa">
      You are getting this because you have Arcyn Find emails turned on.
      <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a">Unsubscribe</a>.
    </p>
  </div>
</body></html>`

  const text = [
    greeting.replace(/&amp;/g, '&'),
    '',
    announcement.title,
    '',
    announcement.body,
    '',
    `${announcement.ctaLabel}: ${ctaUrl}`,
    '',
    '---',
    'You are getting this because you have Arcyn Find emails turned on.',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n')

  return { subject: announcement.title, html, text, unsubscribeUrl }
}

/** One page of people who would receive a digest. Keyset-paginated on id. */
async function fetchPage(afterId: string | null): Promise<{ targets: Target[]; skipped: number; lastId: string | null }> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('user_profiles')
    .select('id, email, display_name, unsubscribe_token, preferences')
    .not('email', 'is', null)
    .order('id', { ascending: true })
    .limit(PAGE_SIZE)

  if (afterId) query = query.gt('id', afterId)

  const { data, error } = await query
  if (error) throw new Error(`announcement recipients (after=${afterId ?? 'start'}): ${error.message}`)

  const rows = data ?? []
  const targets: Target[] = []
  let skipped = 0

  for (const row of rows) {
    const email = typeof row.email === 'string' ? row.email.trim() : ''
    const token = typeof row.unsubscribe_token === 'string' ? row.unsubscribe_token : ''
    const prefs = (row.preferences as Record<string, unknown> | null) ?? null

    // Identical rule to the digest, by import rather than by restatement. No
    // token means no unsubscribe link, and a bulk email without one is not
    // something to send on a best-effort basis.
    if (!email || !token || !wantsDigest(prefs)) {
      skipped += 1
      continue
    }

    targets.push({
      id: String(row.id),
      email,
      displayName: typeof row.display_name === 'string' ? row.display_name : null,
      unsubscribeToken: token,
    })
  }

  return { targets, skipped, lastId: rows.length > 0 ? String(rows[rows.length - 1].id) : null }
}

export async function sendAnnouncement(
  announcement: Announcement,
  options: { dryRun?: boolean; origin?: string } = {}
): Promise<AnnouncementRunResult> {
  const dryRun = options.dryRun ?? false
  // siteUrl(), not NEXT_PUBLIC_SITE_URL directly. That variable is
  // http://localhost:3000 in development and a bulk email must never carry a
  // localhost link; siteUrl() accepts only an https origin and falls back to
  // the production domain, which is exactly right for a message addressed to
  // the public.
  const origin = (options.origin || siteUrl()).replace(/\/+$/, '')

  const result: AnnouncementRunResult = {
    announcementId: announcement.id,
    considered: 0,
    skipped: 0,
    alreadySent: 0,
    sent: 0,
    failed: 0,
    dryRun,
    errors: [],
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey && !dryRun) throw new Error('RESEND_API_KEY is not configured')
  const from = `Arcyn Find <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`
  const resend = apiKey ? new Resend(apiKey) : null

  let afterId: string | null = null
  for (;;) {
    const page = await fetchPage(afterId)
    result.skipped += page.skipped
    result.considered += page.targets.length

    if (page.targets.length > 0) {
      // Claim before sending. A run that dies mid-batch has already recorded
      // who it was about to mail, so resuming skips them rather than sending
      // twice -- the same order the digest uses, for the same reason.
      const claimed = dryRun
        ? new Set(page.targets.map((t) => t.id))
        : await claimRecipients(
            page.targets.map((t) => ({ id: t.id })) as never,
            announcement.id,
            'announcement'
          )

      const fresh = page.targets.filter((t) => claimed.has(t.id))
      result.alreadySent += page.targets.length - fresh.length

      for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
        const batch = fresh.slice(i, i + BATCH_SIZE)
        if (dryRun || !resend) {
          result.sent += batch.length
          continue
        }

        const payload = batch.map((t) => {
          const message = render(announcement, t, origin)
          return {
            from,
            to: t.email,
            subject: message.subject,
            html: message.html,
            text: message.text,
            headers: {
              // One-click unsubscribe. Gmail and Outlook surface this as a
              // native control, and its absence is itself a spam signal.
              'List-Unsubscribe': `<${message.unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }
        })

        try {
          const { error } = await resend.batch.send(payload)
          if (error) {
            result.failed += batch.length
            result.errors.push(error.message)
          } else {
            result.sent += batch.length
          }
        } catch (error) {
          result.failed += batch.length
          result.errors.push((error as Error).message)
        }
      }
    }

    if (!page.lastId || page.targets.length + page.skipped < PAGE_SIZE) break
    afterId = page.lastId
  }

  return result
}
