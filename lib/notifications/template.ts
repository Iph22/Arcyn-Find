import { sanitizeHtml } from '@/lib/security/input-validator'
import type { DigestTool } from './digest-content'

/**
 * The digest email, as HTML and as plain text.
 *
 * Table-based layout with inline styles, because email clients are not
 * browsers -- Outlook's renderer is Word, Gmail strips <style> blocks in some
 * contexts, and flexbox/grid are unusable. This is deliberately dated markup.
 *
 * Every interpolated value is either escaped or URL-validated. Tool names and
 * descriptions are *scraped third-party content* (docs/CORPUS_AND_CONSTRAINTS
 * §1 and §6), so they are hostile input in the same way form input is, and
 * they are going into a document we mail to people.
 */

export interface DigestEmailInput {
  tools: DigestTool[]
  isNew: boolean
  displayName: string | null
  unsubscribeUrl: string
  settingsUrl: string
  siteUrl: string
}

/**
 * Escape for an HTML text node.
 *
 * `sanitizeHtml` also escapes `/` and `=`, which is harmless in text but would
 * mangle a URL -- hence `safeUrl` below rather than reusing this everywhere.
 */
function text(value: string): string {
  return sanitizeHtml(value)
}

/**
 * Admit only absolute http(s) URLs, escaping the few characters that would
 * break out of an attribute.
 *
 * Tool `image` values are scraped, so this is the gate that stops a
 * `javascript:` or `data:` URL reaching an href or src. Returns null when the
 * value is not a usable absolute URL, and callers omit the element entirely.
 */
function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return parsed.toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function toolRowHtml(tool: DigestTool): string {
  const href = safeUrl(tool.url)
  if (!href) return ''

  const image = safeUrl(tool.image)
  const name = text(tool.name)
  const category = text(tool.category)
  const description = text(tool.description)

  // The image cell is dropped rather than left empty when there is no usable
  // URL, so the text column reflows instead of sitting beside a grey gap.
  const imageCell = image
    ? `
              <td width="56" valign="top" style="padding-right:16px;">
                <img src="${image}" width="48" height="48" alt=""
                     style="display:block;width:48px;height:48px;border-radius:10px;object-fit:cover;background:#f1f5f9;" />
              </td>`
    : ''

  return `
          <tr>
            <td style="padding:0 0 24px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>${imageCell}
                  <td valign="top">
                    <a href="${href}" style="color:#0f172a;font-size:16px;font-weight:600;text-decoration:none;">${name}</a>
                    ${category ? `<div style="color:#64748b;font-size:12px;margin-top:2px;">${category}</div>` : ''}
                    <div style="color:#475569;font-size:14px;line-height:21px;margin-top:6px;">${description}</div>
                    <a href="${href}" style="color:#2563eb;font-size:13px;font-weight:500;text-decoration:none;display:inline-block;margin-top:8px;">View tool &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
}

export function renderDigestHtml(input: DigestEmailInput): string {
  const { tools, isNew, displayName, unsubscribeUrl, settingsUrl, siteUrl } = input

  const greeting = displayName ? `Hi ${text(displayName)},` : 'Hi,'
  const intro = isNew
    ? 'Here are the newest AI tools added to Arcyn Find since we last wrote.'
    : 'Here is a handful of AI tools worth a look on Arcyn Find right now.'

  const home = safeUrl(siteUrl) ?? 'https://arcynfind.com'
  const unsub = safeUrl(unsubscribeUrl)
  const settings = safeUrl(settingsUrl)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Your Arcyn Find digest</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <!-- Preheader: shown in the inbox list preview, hidden in the body. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${text(intro)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <a href="${home}" style="color:#0f172a;font-size:18px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Arcyn Find</a>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 4px 28px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 6px 0;color:#0f172a;font-size:15px;">${greeting}</p>
              <p style="margin:0 0 22px 0;color:#475569;font-size:14px;line-height:21px;">${text(intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${tools.map(toolRowHtml).join('')}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 28px 28px;font-family:Arial,Helvetica,sans-serif;">
              <a href="${home}/tools"
                 style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;
                        text-decoration:none;padding:11px 20px;border-radius:8px;">Browse all tools</a>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 26px 28px;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:18px;">
                You are receiving this because you enabled email updates on Arcyn Find.<br />
                ${settings ? `<a href="${settings}" style="color:#64748b;">Manage preferences</a>` : 'Manage preferences in your settings'}
                ${unsub ? ` &middot; <a href="${unsub}" style="color:#64748b;">Unsubscribe</a>` : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Plain-text alternative.
 *
 * Not optional: a multipart message without one is a strong spam signal, and
 * some clients genuinely render it.
 */
export function renderDigestText(input: DigestEmailInput): string {
  const { tools, isNew, displayName, unsubscribeUrl, settingsUrl, siteUrl } = input

  const greeting = displayName ? `Hi ${displayName},` : 'Hi,'
  const intro = isNew
    ? 'Here are the newest AI tools added to Arcyn Find since we last wrote.'
    : 'Here is a handful of AI tools worth a look on Arcyn Find right now.'

  const body = tools
    .map((tool) => `* ${tool.name}${tool.category ? ` (${tool.category})` : ''}\n  ${tool.description}\n  ${tool.url}`)
    .join('\n\n')

  return `${greeting}

${intro}

${body}

Browse all tools: ${siteUrl}/tools

--
You are receiving this because you enabled email updates on Arcyn Find.
Manage preferences: ${settingsUrl}
Unsubscribe: ${unsubscribeUrl}
`
}
