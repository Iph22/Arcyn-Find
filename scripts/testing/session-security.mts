/**
 * Exercises lib/session.ts against the attacks it is meant to stop.
 *
 *   npm run test:session
 *
 * Needs no server, no database and no quota -- it is pure crypto, so it is the
 * cheap regression guard for the signed-session work. The companion
 * session-security-e2e.mjs drives the same properties through a running server.
 */
import {
    signSession,
    verifySession,
    safeRedirectPath,
    nonceMatches,
    createOAuthNonce,
    encodeOAuthState,
    decodeOAuthState,
    type SessionPayload,
} from '../../lib/session.ts'

if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = 'test-only-secret-that-is-long-enough-32'
}

let failures = 0
function check(name: string, condition: boolean) {
    console.log(`${condition ? '  ok  ' : ' FAIL '} ${name}`)
    if (!condition) failures++
}

const future = new Date(Date.now() + 60_000).toISOString()
const past = new Date(Date.now() - 60_000).toISOString()

function payload(overrides: Partial<SessionPayload> = {}): SessionPayload {
    return {
        user: { id: 'user-123', email: 'a@b.com', name: 'Ada Lovelace', picture: 'https://x/y.png' },
        createdAt: new Date().toISOString(),
        expiresAt: future,
        ...overrides,
    }
}

async function main() {
    // --- round trip -----------------------------------------------------------
    const token = await signSession(payload())
    const verified = await verifySession(token)
    check('valid token round-trips', verified?.user.id === 'user-123')
    check('token has two parts', token.split('.').length === 2)

    // --- the original vulnerability -------------------------------------------
    const forged = btoa(JSON.stringify(payload({ user: { id: 'victim', email: 'v@b.com', name: 'V', picture: '' } })))
    check('old unsigned cookie is rejected', (await verifySession(forged)) === null)

    const forgedUnpadded = forged.replace(/=+$/, '')
    check('old unsigned cookie (unpadded) is rejected', (await verifySession(forgedUnpadded)) === null)

    // --- tampering ------------------------------------------------------------
    const [body, sig] = token.split('.')
    const swapped = await (async () => {
        const evil = payload({ user: { id: 'somebody-else', email: 'e@b.com', name: 'E', picture: '' } })
        const evilBody = Buffer.from(JSON.stringify(evil)).toString('base64url')
        return `${evilBody}.${sig}`
    })()
    check('payload swap with a stolen signature is rejected', (await verifySession(swapped)) === null)

    // The FIRST character, not the last. A 32-byte HMAC is 43 base64url
    // characters: 258 bits carrying 256, so the final character's low 2 bits
    // are padding and only 16 of the 64 alphabet characters can ever appear
    // there (048AEIMQUYcgkosw). Altering the last character therefore often
    // decodes to the very same bytes -- when the signature ended in 'A' this
    // swapped in 'B', which is byte-identical, so verifySession rightly
    // accepted it and the check failed. Measured at 6.7% of runs, which is
    // exactly the 1-in-16 that theory predicts.
    //
    // Every bit of the first character is significant, so this always changes
    // the signature. Do not "simplify" it back to slice(-1).
    const flipped = `${body}.${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`
    check('signature bit-flip is rejected', (await verifySession(flipped)) === null)

    // --- shape and expiry -----------------------------------------------------
    check('expired token is rejected', (await verifySession(await signSession(payload({ expiresAt: past })))) === null)

    const noExpiry = { user: payload().user, createdAt: new Date().toISOString() } as unknown as SessionPayload
    check('token with no expiry is rejected (not treated as eternal)', (await verifySession(await signSession(noExpiry))) === null)

    const noUser = { createdAt: new Date().toISOString(), expiresAt: future } as unknown as SessionPayload
    check('token with no user is rejected', (await verifySession(await signSession(noUser))) === null)

    // --- malformed input never throws ----------------------------------------
    for (const bad of ['', 'x', '.', 'a.', '.b', 'a.b.c', 'not base64!.nope', 'a'.repeat(5000)]) {
        const result = await verifySession(bad).catch(() => 'THREW')
        check(`malformed input ${JSON.stringify(bad.slice(0, 20))} returns null`, result === null)
    }
    check('undefined returns null', (await verifySession(undefined)) === null)

    // --- unicode (btoa would throw on these) ----------------------------------
    const unicode = payload({ user: { id: 'u1', email: 'jose@b.com', name: '李明 · José 😀', picture: '' } })
    const unicodeVerified = await verifySession(await signSession(unicode))
    check('unicode display name survives round trip', unicodeVerified?.user.name === '李明 · José 😀')

    // --- key rotation ---------------------------------------------------------
    const original = process.env.SESSION_SECRET
    process.env.SESSION_SECRET = 'a-completely-different-secret-value-32+'
    check('token from the old secret fails after rotation', (await verifySession(token)) === null)
    process.env.SESSION_SECRET = original
    check('token verifies again once the secret is restored', (await verifySession(token))?.user.id === 'user-123')

    // --- missing secret fails closed -----------------------------------------
    delete process.env.SESSION_SECRET
    check('verify returns null with no secret', (await verifySession(token)) === null)
    let signThrew = false
    try { await signSession(payload()) } catch { signThrew = true }
    check('sign throws with no secret', signThrew)
    process.env.SESSION_SECRET = original

    // --- open redirect --------------------------------------------------------
    const evilRedirects = [
        'https://evil.com', 'http://evil.com', '//evil.com', '/\\evil.com',
        'javascript:alert(1)', 'evil.com', '', null, undefined, 42,
    ]
    for (const value of evilRedirects) {
        check(`redirect ${JSON.stringify(value)} is neutralised`, safeRedirectPath(value) === '/home')
    }
    check('legitimate path is preserved', safeRedirectPath('/collections/42') === '/collections/42')

    // --- oauth state ----------------------------------------------------------
    const nonce = createOAuthNonce()
    check('nonce is 64 hex chars', /^[0-9a-f]{64}$/.test(nonce))
    check('nonces differ', createOAuthNonce() !== createOAuthNonce())

    const state = encodeOAuthState({ nonce, redirectPath: '/settings' })
    const decoded = decodeOAuthState(state)
    check('state round-trips', decoded?.nonce === nonce && decoded?.redirectPath === '/settings')
    check('state with an absolute redirect is sanitised',
        decodeOAuthState(encodeOAuthState({ nonce, redirectPath: 'https://evil.com' }))?.redirectPath === '/home')
    check('garbage state returns null', decodeOAuthState('!!!not-base64!!!') === null)
    check('empty state returns null', decodeOAuthState(null) === null)

    check('nonceMatches accepts equal', nonceMatches(nonce, nonce))
    check('nonceMatches rejects different', !nonceMatches(nonce, createOAuthNonce()))
    check('nonceMatches rejects undefined', !nonceMatches(nonce, undefined))
    check('nonceMatches rejects empty', !nonceMatches('', ''))

    console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} FAILED`)
    process.exit(failures === 0 ? 0 : 1)
}

main()
