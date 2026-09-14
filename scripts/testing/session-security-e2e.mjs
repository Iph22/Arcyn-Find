/**
 * Drives the signed-session and OAuth-state properties through a running server.
 *
 *   npm run dev -- -p 3311
 *   npm run test:session:e2e            # or BASE_URL=... npm run test:session:e2e
 *
 * Reads SESSION_SECRET from .env.local so it can mint a cookie the server will
 * accept -- that is what proves the fix did not simply break sign-in for
 * everyone, which a rejection-only test would happily report as success.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const BASE = process.env.BASE_URL || 'http://localhost:3311'
const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const envPath = path.join(PROJECT, '.env.local')
if (!fs.existsSync(envPath)) {
    console.error(`No .env.local at ${envPath} -- cannot read SESSION_SECRET.`)
    process.exit(1)
}

const secretMatch = fs.readFileSync(envPath, 'utf8').match(/^SESSION_SECRET=(.*)$/m)
if (!secretMatch) {
    console.error('SESSION_SECRET is not set in .env.local. See .env.example.')
    process.exit(1)
}
const SECRET = secretMatch[1].trim()

let failures = 0
const check = (name, ok, detail = '') => {
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? `  [${detail}]` : ''}`)
    if (!ok) failures++
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')

/** Mint a token the server should accept, using the same scheme as lib/session.ts. */
function mintValidToken(userId = 'e2e-user') {
    const payload = b64url(JSON.stringify({
        user: { id: userId, email: 'e2e@test.com', name: 'E2E', picture: '' },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }))
    const sig = crypto.createHmac('sha256', SECRET).update(payload).digest()
    return `${payload}.${b64url(sig)}`
}

/** The exact cookie the old code would have issued -- the vulnerability. */
function mintForgedLegacyCookie(userId = 'victim-account') {
    return Buffer.from(JSON.stringify({
        user: { id: userId, email: 'victim@test.com', name: 'Victim', picture: '' },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 9e10).toISOString(),
    })).toString('base64')
}

// Named `route`, not `path`, so it does not shadow the node:path import above.
const get = (route, cookie) => fetch(`${BASE}${route}`, {
    redirect: 'manual',
    headers: cookie ? { cookie } : {},
})

async function main() {
    // --- 1. OAuth initiation sets a nonce cookie -----------------------------
    const init = await get('/api/auth/google')
    const location = init.headers.get('location') || ''
    const cookies = init.headers.getSetCookie()
    const setCookie = cookies.join('; ')
    const nonceCookie = cookies.find(c => c.startsWith('arcyn_oauth_state=')) || ''

    check('initiation redirects to Google', location.startsWith('https://accounts.google.com/'), `${init.status}`)
    check('initiation sets arcyn_oauth_state cookie', setCookie.includes('arcyn_oauth_state='))
    check('nonce cookie is httpOnly', /;\s*HttpOnly/i.test(nonceCookie))
    check('nonce cookie is sameSite=lax', /;\s*SameSite=lax/i.test(nonceCookie))
    check('nonce cookie is short-lived', /;\s*Max-Age=600\b/.test(nonceCookie))

    const stateParam = new URL(location).searchParams.get('state')
    check('state param is present', !!stateParam)

    const decodedState = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    check('state carries a 64-hex nonce', /^[0-9a-f]{64}$/.test(decodedState.nonce))
    const cookieNonce = setCookie.match(/arcyn_oauth_state=([^;]+)/)[1]
    check('state nonce matches the cookie nonce', decodedState.nonce === cookieNonce)

    // --- 2. Open redirect is neutralised -------------------------------------
    const evil = await get('/api/auth/google?redirect=' + encodeURIComponent('https://evil.com'))
    const evilState = new URL(evil.headers.get('location')).searchParams.get('state')
    const evilDecoded = JSON.parse(Buffer.from(evilState, 'base64url').toString())
    check('absolute ?redirect= is rewritten to /home', evilDecoded.redirectPath === '/home', evilDecoded.redirectPath)

    const proto = await get('/api/auth/google?redirect=' + encodeURIComponent('//evil.com'))
    const protoState = new URL(proto.headers.get('location')).searchParams.get('state')
    const protoDecoded = JSON.parse(Buffer.from(protoState, 'base64url').toString())
    check('protocol-relative ?redirect= is rewritten to /home', protoDecoded.redirectPath === '/home', protoDecoded.redirectPath)

    const good = await get('/api/auth/google?redirect=' + encodeURIComponent('/collections/7'))
    const goodState = new URL(good.headers.get('location')).searchParams.get('state')
    const goodDecoded = JSON.parse(Buffer.from(goodState, 'base64url').toString())
    check('relative ?redirect= is preserved', goodDecoded.redirectPath === '/collections/7', goodDecoded.redirectPath)

    // --- 3. Callback rejects an unbacked state -------------------------------
    const attackerState = Buffer.from(JSON.stringify({
        nonce: 'a'.repeat(64), redirectPath: '/home',
    })).toString('base64url')

    const noCookie = await get(`/api/auth/callback/google?code=stolen&state=${attackerState}`)
    check('callback rejects state with no nonce cookie',
        (noCookie.headers.get('location') || '').includes('error=invalid_state'),
        noCookie.headers.get('location'))

    const wrongCookie = await get(
        `/api/auth/callback/google?code=stolen&state=${attackerState}`,
        `arcyn_oauth_state=${'b'.repeat(64)}`)
    check('callback rejects a mismatched nonce',
        (wrongCookie.headers.get('location') || '').includes('error=invalid_state'))

    const noState = await get('/api/auth/callback/google?code=stolen')
    check('callback rejects a missing state',
        (noState.headers.get('location') || '').includes('error=invalid_state'))

    // --- 4. The original vulnerability, through the real server --------------
    const forged = mintForgedLegacyCookie()

    const forgedSession = await get('/api/auth/session', `arcyn_session=${forged}`)
    const forgedBody = await forgedSession.json()
    check('forged legacy cookie is NOT authenticated on /api/auth/session',
        forgedBody.isAuthenticated === false && forgedBody.user === null,
        JSON.stringify(forgedBody))

    const forgedHome = await get('/home', `arcyn_session=${forged}`)
    check('forged legacy cookie is bounced off /home by the proxy',
        forgedHome.status >= 300 && forgedHome.status < 400 &&
        (forgedHome.headers.get('location') || '').includes('/sign-in'),
        `${forgedHome.status} -> ${forgedHome.headers.get('location')}`)

    check('proxy clears the rejected cookie',
        forgedHome.headers.getSetCookie().some(c => /arcyn_session=;|arcyn_session=(?:;|$)/.test(c)),
        forgedHome.headers.getSetCookie().join(' | ') || 'no Set-Cookie')

    // --- 5. No cookie at all --------------------------------------------------
    const anon = await get('/home')
    check('anonymous visitor is bounced off /home',
        (anon.headers.get('location') || '').includes('/sign-in'))

    // --- 6. The happy path still works ---------------------------------------
    const validToken = mintValidToken()

    const validSession = await get('/api/auth/session', `arcyn_session=${validToken}`)
    const validBody = await validSession.json()
    check('properly signed cookie IS authenticated',
        validBody.isAuthenticated === true && validBody.user?.id === 'e2e-user',
        JSON.stringify(validBody))

    const validHome = await get('/home', `arcyn_session=${validToken}`)
    check('properly signed cookie reaches /home',
        validHome.status === 200,
        `${validHome.status} -> ${validHome.headers.get('location') || 'rendered'}`)

    // --- 7. Tampering with a real token --------------------------------------
    const [vBody] = validToken.split('.')
    const escalated = Buffer.from(Buffer.from(vBody, 'base64url').toString()
        .replace('e2e-user', 'admin-usr')).toString('base64url')
    const tampered = `${escalated}.${validToken.split('.')[1]}`

    const tamperedSession = await get('/api/auth/session', `arcyn_session=${tampered}`)
    const tamperedBody = await tamperedSession.json()
    check('editing the user id in a signed cookie invalidates it',
        tamperedBody.isAuthenticated === false,
        JSON.stringify(tamperedBody))

    // --- 8. Public routes are unaffected -------------------------------------
    const publicPage = await get('/tools')
    check('public /tools still renders for anonymous visitors',
        publicPage.status === 200, `${publicPage.status}`)

    console.log(failures === 0 ? '\nAll end-to-end checks passed.' : `\n${failures} FAILED`)
    process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
