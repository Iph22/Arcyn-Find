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
 * exactly the gap a deploy gate should cover. Nothing here needs credentials.
 */

const BASE = (process.argv[2] || process.env.BASE_URL || 'https://arcynfind.com').replace(/\/+$/, '')

/** A sitemap that lost its tool pages still returns 200; 8 was the broken shape. */
const MIN_SITEMAP_URLS = 100

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}   ${label}${detail ? '  (' + detail + ')' : ''}`)
  if (!ok) failures++
}

async function get(path) {
  const res = await fetch(BASE + path, {
    headers: { 'user-agent': 'arcyn-smoke/1.0' },
    signal: AbortSignal.timeout(60_000),
  })
  return { status: res.status, body: await res.text() }
}

console.log(`smoke test: ${BASE}\n`)

try {
  for (const path of ['/', '/tools', '/tools/category', '/sitemap.xml', '/robots.txt']) {
    const { status } = await get(path)
    check(`${path} responds 200`, status === 200, `HTTP ${status}`)
  }

  // The homepage must state a real catalog size, not the placeholder.
  const home = await get('/')
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
  check('reachable', false, error.message)
}

console.log(failures === 0 ? '\nHealthy.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
