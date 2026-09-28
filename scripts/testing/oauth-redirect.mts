/**
 * The OAuth callback URI must equal the origin the request arrived on.
 *
 * This is the check that would have caught `?error=invalid_state` on preview
 * deployments: the redirect_uri came from NEXT_PUBLIC_SITE_URL, one value
 * shared by all three Vercel targets, so a preview sent Google the production
 * domain and the callback then ran somewhere the state cookie did not exist.
 *
 * Pure -- no network, no server. Run: npx tsx scripts/testing/oauth-redirect.mts
 */

import { googleCallbackUri, isAllowedOAuthOrigin } from '../../lib/oauth-redirect'

let failures = 0

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

/** A request as Vercel's proxy presents it. */
function proxied(host: string, proto = 'https'): Request {
  return new Request('https://internal.invalid/api/auth/google', {
    headers: { 'x-forwarded-host': host, 'x-forwarded-proto': proto },
  })
}

const PROD = 'https://arcynfind.com'
const PREVIEW = 'arcyn-find-git-main-iphys-project.vercel.app'

console.log('\nThe callback follows the host the request arrived on')
check(
  'production',
  googleCallbackUri(proxied('arcynfind.com')) === `${PROD}/api/auth/callback/google`,
  googleCallbackUri(proxied('arcynfind.com'))
)
check(
  'branch preview',
  googleCallbackUri(proxied(PREVIEW)) === `https://${PREVIEW}/api/auth/callback/google`,
  googleCallbackUri(proxied(PREVIEW))
)
check(
  'per-deployment preview',
  googleCallbackUri(proxied('arcyn-find-gq9b3iufg-iphys-project.vercel.app')).startsWith(
    'https://arcyn-find-gq9b3iufg'
  )
)

console.log('\nBoth halves of one flow agree')
// The bug in one line: authorisation and token exchange must produce the same
// string, or Google answers redirect_uri_mismatch. They run on the same host.
for (const host of ['arcynfind.com', PREVIEW]) {
  const atAuth = googleCallbackUri(proxied(host))
  const atExchange = googleCallbackUri(proxied(host))
  check(`${host}: authorise === exchange`, atAuth === atExchange)
}

console.log('\nA forged host does not become a redirect target')
const forged = googleCallbackUri(proxied('evil.example.com'))
check(
  'unknown host falls back instead of echoing',
  !forged.includes('evil.example.com'),
  forged
)
check('evil.example.com is not an allowed origin', !isAllowedOAuthOrigin('https://evil.example.com'))
check('http vercel host is not allowed', !isAllowedOAuthOrigin('http://x.vercel.app'))
check(
  'a lookalike domain is not allowed',
  !isAllowedOAuthOrigin('https://arcynfind.com.evil.example.com')
)
check('a vercel-suffixed impostor is not allowed', !isAllowedOAuthOrigin('https://vercel.app.evil.com'))

console.log('\nMultiple proxies append to x-forwarded-host')
check(
  'takes the client-nearest entry',
  googleCallbackUri(proxied('arcynfind.com, internal.vercel.app')) ===
    `${PROD}/api/auth/callback/google`
)

console.log('\nFalls back to Host when x-forwarded-host is absent')
const bare = new Request('https://arcynfind.com/api/auth/google')
check('bare request', googleCallbackUri(bare) === `${PROD}/api/auth/callback/google`, googleCallbackUri(bare))

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
