/**
 * Does a sign-in that started somewhere specific end up back there?
 *
 * The bug this covers was invisible from every direction. The server has
 * supported `?redirect=` the whole time -- /api/auth/google runs it through
 * safeRedirectPath, seals it into the signed OAuth state, and the callback
 * uses it. The sign-in page accepted a `redirect` query parameter without
 * reading it. And the auth context wrote the destination into
 * sessionStorage.auth_redirect, which nothing anywhere ever read back, then
 * requested /api/auth/google with no parameters at all.
 *
 * So every part looked implemented, and every sign-in landed on /home.
 *
 * Checks the one hop that was broken: that the authorisation URL carries the
 * destination, and that it refuses to carry one that would leave the site.
 *
 * Run: npx tsx scripts/testing/sign-in-redirect.mts [baseUrl]
 */

const BASE = process.argv[2] || 'http://localhost:3000'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

/** The `state` Google is handed, decoded. */
function decodeState(location: string): { redirectPath?: string } | null {
  try {
    const state = new URL(location).searchParams.get('state')
    if (!state) return null
    const json = Buffer.from(state, 'base64url').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

async function start(redirect?: string) {
  const url = redirect
    ? `${BASE}/api/auth/google?redirect=${encodeURIComponent(redirect)}`
    : `${BASE}/api/auth/google`
  const res = await fetch(url, { redirect: 'manual' })
  return { status: res.status, location: res.headers.get('location') ?? '' }
}

console.log('\nThe destination survives into the OAuth state')
for (const target of ['/submit', '/collections', '/tools/cursor']) {
  const { status, location } = await start(target)
  const state = decodeState(location)
  check(
    `${target} is carried`,
    status >= 300 && status < 400 && state?.redirectPath === target,
    `HTTP ${status}, state.redirectPath=${JSON.stringify(state?.redirectPath)}`
  )
}

console.log('\nWithout one, it falls back rather than breaking')
{
  const { status, location } = await start()
  const state = decodeState(location)
  check('bare sign-in still works', status >= 300 && status < 400, `HTTP ${status}`)
  check('and defaults somewhere sane', typeof state?.redirectPath === 'string', JSON.stringify(state?.redirectPath))
}

console.log('')
console.log('Pages that bounce an authenticated user are not destinations')
// `/`, `/sign-in` and `/sign-up` all push a signed-in user away the moment they
// load. Returning to one means watching it render and then be replaced -- the
// flash of the landing page this covers. Not a security rule; a statement that
// an entrance is not somewhere to be sent back to.
for (const entry of ['/', '/sign-in', '/sign-up', '/?ref=x']) {
  const { location } = await start(entry)
  const path = String(decodeState(location)?.redirectPath ?? '')
  check(entry + ' does not become the destination', path === '/home', 'redirectPath=' + JSON.stringify(path))
}

console.log('\nA destination that would leave the site is refused')
// safeRedirectPath is what stops an open redirect: the value round-trips
// through the browser, so a crafted link must not be able to send somebody
// off-site with a freshly minted session.
for (const hostile of ['https://evil.example.com', '//evil.example.com', 'javascript:alert(1)']) {
  const { location } = await start(hostile)
  const state = decodeState(location)
  const path = String(state?.redirectPath ?? '')
  check(
    `${hostile} is not carried`,
    path.startsWith('/') && !path.startsWith('//') && !path.includes('evil'),
    `redirectPath=${JSON.stringify(state?.redirectPath)}`
  )
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
