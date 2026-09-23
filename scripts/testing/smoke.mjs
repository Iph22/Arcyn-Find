#!/usr/bin/env node
/**
 * Is a deployment actually serving the site?
 *
 *   npm run smoke                                  # production
 *   npm run smoke -- https://arcyn-find-abc.vercel.app   # a preview (the green)
 *
 * This is the verify step of the blue-green flow: point it at the preview
 * Vercel built for a merge to `main`, and only promote if it passes.
 *
 * WHAT IT CHECKS, AND WHY THOSE THINGS
 *
 * Not a generic "is it up" probe. Both assertions below are regressions this
 * project actually shipped:
 *
 *   - The homepage rendered an em dash instead of the catalog count, because
 *     the figures are read from the database at render time and the read
 *     failed. A 200 with a dash looks fine to uptime monitoring.
 *   - The sitemap served 8 URLs instead of 2,628, because a failed query was
 *     being swallowed and the static pages published as if they were the whole
 *     site. Also a 200.
 *
 * Both are invisible to a status-code check and visible to a visitor, which is
 * exactly the gap a deploy gate should cover.
 *
 * DEPLOYMENT PROTECTION
 *
 * Preview deployments sit behind Vercel Deployment Protection, which answers
 * 200 with an SSO login page. Every content assertion then fails saying the
 * database is unreachable, which is untrue and sends you looking in the wrong
 * place -- it happened on the first CI run of this gate. `VERCEL_AUTOMATION_
 * BYPASS_SECRET` (Vercel > Settings > Deployment Protection > Protection
 * Bypass for Automation) is what lets automation through; without it the login
 * wall is detected and reported as itself.
 */

const BASE = (process.argv[2] || process.env.BASE_URL || 'https://arcynfind.com').replace(/\/+$/, '')
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''

/** A sitemap that lost its tool pages still returns 200; 8 was the broken shape. */
const MIN_SITEMAP_URLS = 100

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}   ${label}${detail ? '  (' + detail + ')' : ''}`)
  if (!ok) failures++
}

/**
 * `fetch` rejects with a bare "fetch failed" and puts the reason in `cause`.
 * Reporting only the message told us a deployment was unreachable without ever
 * saying why, which is how a DNS race and a protection wall look identical.
 */
const reason = (error) => {
  const parts = [error.message]
  for (let c = error.cause; c; c = c.cause) parts.push(c.message ?? String(c))
  return [...new Set(parts)].join(' <- ')
}

/**
 * Retries the network layer, not the assertions.
 *
 * This runs off Vercel's `deployment_status` webhook, which fires when the
 * deployment is marked ready -- the generated hostname can still be a moment
 * behind at the edge, and the first attempt then throws before the site is
 * reachable at all. A failed assertion is never retried; only a throw is.
 */
async function get(path, attempts = 3) {
  const headers = { 'user-agent': 'arcyn-smoke/1.0' }
  if (BYPASS) {
    headers['x-vercel-protection-bypass'] = BYPASS
    headers['x-vercel-set-bypass-cookie'] = 'true'
  }

  let last
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(BASE + path, { headers, signal: AbortSignal.timeout(60_000) })
      return { status: res.status, body: await res.text(), url: res.url }
    } catch (error) {
      last = error
      if (attempt < attempts) {
        const wait = attempt * 3000
        console.log(`  ...${path} did not connect (${reason(error)}); retrying in ${wait / 1000}s`)
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  throw last
}

/** Vercel's protection wall answers 200 with a login page, not the site. */
const isAuthWall = ({ body, url }) =>
  /\/sso-api|vercel\.com\/login/.test(url) || /_vercel_sso_nonce|Authentication Required/i.test(body)

console.log(`smoke test: ${BASE}\n`)

try {
  const home = await get('/')

  // Bail before the content checks rather than reporting five misleading ones.
  if (isAuthWall(home)) {
    check('deployment is publicly reachable', false, 'Vercel Deployment Protection')
    console.log(
      '\nThis deployment is behind Vercel Deployment Protection, which answers HTTP 200\n' +
        'with a login page. The checks below would all fail for a reason that has nothing\n' +
        'to do with the build, so they were skipped.\n'
    )
    console.log(
      BYPASS
        ? 'VERCEL_AUTOMATION_BYPASS_SECRET is set but was not accepted. Regenerate it at\n' +
            'Vercel > Settings > Deployment Protection > Protection Bypass for Automation.'
        : 'Set VERCEL_AUTOMATION_BYPASS_SECRET to the value at Vercel > Settings >\n' +
            'Deployment Protection > Protection Bypass for Automation, and expose it to\n' +
            'this job. Production is not protected, so it needs no secret.'
    )
    process.exit(1)
  }

  check('/ responds 200', home.status === 200, `HTTP ${home.status}`)
  for (const path of ['/tools', '/tools/category', '/sitemap.xml', '/robots.txt']) {
    const { status } = await get(path)
    check(`${path} responds 200`, status === 200, `HTTP ${status}`)
  }

  // The homepage must state a real catalog size, not the placeholder.
  const count = home.body.match(/([0-9]{1,3},[0-9]{3})\s+AI tools/)
  check(
    'homepage states a catalog count',
    count !== null,
    count ? count[1] : 'no count found — is the database reachable?'
  )

  const sitemap = await get('/sitemap.xml')
  const locs = (sitemap.body.match(/<loc>/g) || []).length
  check(`sitemap has more than ${MIN_SITEMAP_URLS} URLs`, locs > MIN_SITEMAP_URLS, `${locs} URLs`)
} catch (error) {
  check('reachable', false, reason(error))
}

console.log(failures === 0 ? '\nHealthy.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
