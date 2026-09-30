/**
 * Automated screening for a submitted tool.
 *
 * WHAT THIS IS FOR
 *
 * Submissions are reviewed by a person, and that person cannot open every URL
 * and judge every claim by hand. This gathers the evidence for that decision
 * so the judgement takes seconds: it fetches the page, checks the claim
 * against what is actually there, and reports what it found.
 *
 * WHAT IT DELIBERATELY IS NOT
 *
 * It does not decide. Every check returns `pass`, `fail` or `unknown`, and
 * `unknown` is a first-class answer rather than a rounded-down `fail`. That
 * distinction is the whole design, and it comes from a measurement: probing
 * the 60 most popular published tools, 3.3% were genuinely dead while **23%**
 * answered 403 to an automated request -- Canva, OpenAI, Make, RapidMiner,
 * Quizlet, all alive and all refusing bots. A screen that scored a failed
 * request as a bad tool would reject a quarter of the real ones.
 *
 * It also makes no AI calls. The generation quota is roughly 20 calls a day,
 * which is not a budget a submission form can draw on, and none of what
 * matters here needs a model: whether a domain resolves, whether the page
 * mentions the product it claims to be, whether the description is more than
 * a sentence of filler, whether this is already in the catalog.
 */

import { rateContent } from './seo/content-rating'
import { normalizeName } from './seo/slug'

export type CheckStatus = 'pass' | 'fail' | 'unknown'

export interface Check {
  id: string
  /** Shown to the reviewer, so it says what happened, not what was tested. */
  label: string
  status: CheckStatus
  detail: string
  /** Weight toward the score. `unknown` never scores either way. */
  weight: number
}

export interface Screening {
  checks: Check[]
  /** 0-100 over the checks that actually returned an answer. */
  score: number
  /** Set when a check found something that should block approval outright. */
  blocking: string[]
  screenedAt: string
}

const FETCH_TIMEOUT_MS = 12000

/** Hosts that mean "this is not a product yet". */
const LOW_SIGNAL_HOSTS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'linktr.ee',
  'notion.site', 'sites.google.com', 'wixsite.com', 'blogspot.com',
  'wordpress.com', 'weebly.com', 'github.io', 'vercel.app', 'netlify.app',
]

function check(id: string, label: string, status: CheckStatus, detail: string, weight = 1): Check {
  return { id, label, status, detail, weight }
}

/**
 * Fetch the submitted page once. Everything that needs the page body shares
 * this, so a submission costs one outbound request rather than five.
 */
async function fetchPage(target: string): Promise<
  { ok: true; status: number; html: string } | { ok: false; status: number | null; reason: string }
> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(target, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'ArcynFind-Screening/1.0 (+https://arcynfind.com)',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    // Cap the read: a screening job has no business pulling a 40MB page.
    const html = (await res.text()).slice(0, 400_000)
    return { ok: true, status: res.status, html }
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause?.code || ''
    const message = (error as Error).message || ''
    if (cause === 'ENOTFOUND' || cause === 'EAI_AGAIN') {
      return { ok: false, status: null, reason: 'DNS does not resolve' }
    }
    if (message.includes('aborted')) {
      return { ok: false, status: null, reason: `no answer in ${FETCH_TIMEOUT_MS}ms` }
    }
    return { ok: false, status: null, reason: cause || message.slice(0, 80) }
  } finally {
    clearTimeout(timer)
  }
}

/** Visible text, roughly. Good enough to ask "does this page say its own name". */
function stripMarkup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export interface SubmissionInput {
  name: string
  description: string
  url: string
  tags?: string[]
  /** Names already in the catalog, normalised. Supplied by the caller so this
   *  module stays free of database access and can be unit-tested. */
  existingNames?: Set<string>
}

export async function screenSubmission(input: SubmissionInput): Promise<Screening> {
  const checks: Check[] = []
  const blocking: string[] = []
  const name = input.name.trim()
  const description = input.description.trim()

  // --- claims that can be judged without leaving the process ----------------

  let parsed: URL | null = null
  try {
    parsed = new URL(input.url)
  } catch {
    parsed = null
  }

  if (!parsed) {
    checks.push(check('url-valid', 'URL is not a valid address', 'fail', input.url.slice(0, 80), 3))
    blocking.push('The submitted URL is not a valid address.')
  } else {
    checks.push(
      parsed.protocol === 'https:'
        ? check('https', 'Served over HTTPS', 'pass', parsed.origin)
        : check('https', 'Not served over HTTPS', 'fail', parsed.protocol, 2)
    )

    const host = parsed.hostname.replace(/^www\./, '')
    const lowSignal = LOW_SIGNAL_HOSTS.find((h) => host === h || host.endsWith(`.${h}`))
    checks.push(
      lowSignal
        ? check(
            'own-domain',
            'Hosted on a shared or link-shortener domain',
            'fail',
            `${host} — a real product usually has its own domain`,
            2
          )
        : check('own-domain', 'Has its own domain', 'pass', host)
    )
  }

  const words = description.split(/\s+/).filter(Boolean).length
  checks.push(
    words >= 12
      ? check('description', 'Description is substantive', 'pass', `${words} words`)
      : check('description', 'Description is very short', 'fail', `${words} words — under 12`, 2)
  )

  const rating = rateContent({ name, rawDescription: description, tags: input.tags ?? [] })
  if (rating === 'prohibited') {
    checks.push(check('safety', 'Content screen: prohibited', 'fail', 'matches the non-consensual imagery rules', 5))
    blocking.push('The description matches the prohibited-content rules and cannot be published.')
  } else if (rating === 'adult') {
    checks.push(check('safety', 'Content screen: adult', 'unknown', 'would be listed but never indexed', 0))
  } else {
    checks.push(check('safety', 'Content screen: general', 'pass', 'nothing flagged'))
  }

  if (input.existingNames) {
    const normalised = normalizeName(name)
    const duplicate = input.existingNames.has(normalised)
    checks.push(
      duplicate
        ? check('duplicate', 'Already in the catalog', 'fail', `"${name}" matches an existing tool`, 3)
        : check('duplicate', 'Not already in the catalog', 'pass', 'no name match')
    )
    if (duplicate) blocking.push(`"${name}" is already in the catalog.`)
  }

  // --- claims that need the page itself -------------------------------------

  if (parsed) {
    const page = await fetchPage(parsed.toString())

    if (!page.ok) {
      // Unreachable is not the same as gone. See the note at the top.
      checks.push(check('reachable', 'Could not reach the site', 'unknown', page.reason, 0))
    } else if (page.status === 404 || page.status === 410) {
      checks.push(check('reachable', 'Page does not exist', 'fail', `HTTP ${page.status}`, 3))
      blocking.push(`The submitted URL returns HTTP ${page.status}.`)
    } else if (page.status >= 500) {
      checks.push(check('reachable', 'Site is erroring', 'fail', `HTTP ${page.status}`, 2))
    } else if (page.status === 403 || page.status === 401 || page.status === 429) {
      checks.push(
        check('reachable', 'Site refused an automated request', 'unknown', `HTTP ${page.status} — common for real products`, 0)
      )
    } else {
      checks.push(check('reachable', 'Site responds', 'pass', `HTTP ${page.status}`))

      // Does the page admit to being the thing it was submitted as? This is the
      // single most useful signal that a submission is honest, and it cannot be
      // faked by filling the form in nicely.
      const text = stripMarkup(page.html)
      const needle = normalizeName(name)
      const mentions = needle.length > 2 && text.includes(needle)
      checks.push(
        mentions
          ? check('name-on-page', 'The page names this tool', 'pass', `found "${name}"`, 2)
          : check('name-on-page', 'The page never names this tool', 'fail', `no "${name}" in the page text`, 2)
      )

      const title = page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
      checks.push(
        title
          ? check('title', 'Page has a title', 'pass', title.slice(0, 90))
          : check('title', 'Page has no title', 'fail', 'likely a parked domain or an error page', 1)
      )
    }
  }

  // Score over the checks that actually answered. A submission whose site
  // refuses bots is not penalised for it -- it simply has less evidence.
  const answered = checks.filter((c) => c.status !== 'unknown' && c.weight > 0)
  const earned = answered.filter((c) => c.status === 'pass').reduce((sum, c) => sum + c.weight, 0)
  const possible = answered.reduce((sum, c) => sum + c.weight, 0)

  return {
    checks,
    score: possible === 0 ? 0 : Math.round((earned / possible) * 100),
    blocking,
    screenedAt: new Date().toISOString(),
  }
}
