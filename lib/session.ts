/**
 * Signed session cookies and the OAuth handshake state.
 *
 * The previous implementation stored the session as `btoa(JSON.stringify(...))`.
 * Base64 is an encoding, not a signature: any visitor could mint a cookie for
 * any user id, and every route that trusts `getCurrentUser()` would believe it.
 * Those routes then query Supabase with the service-role key, which bypasses
 * RLS entirely, so a forged cookie was full account takeover rather than a
 * scoped read. Both `getSession()` and `proxy.ts` decoded it that way.
 *
 * A session token is now `<payload>.<signature>`, both base64url:
 *
 *   payload   = UTF-8 JSON of SessionPayload
 *   signature = HMAC-SHA256(payload, SESSION_SECRET)
 *
 * The signature covers the *encoded* payload string rather than the parsed
 * object, so there is no JSON canonicalisation question at verify time.
 *
 * This module is deliberately dependency-free and built on Web Crypto
 * (`crypto.subtle`, present in both the Node and Edge runtimes) because
 * `proxy.ts` imports it alongside ordinary server code. `jose` would do the
 * same job with real JWTs if a dependency ever becomes preferable; the Next.js
 * auth guide recommends it.
 *
 * NOTE: this file must not carry `"use server"`. That directive turns every
 * export into a client-callable server action, and `proxy.ts` cannot import
 * from such a module.
 */

export const SESSION_COOKIE_NAME = 'arcyn_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

export interface SessionUser {
    id: string
    email: string
    name: string
    picture: string
}

export interface SessionPayload {
    user: SessionUser
    createdAt: string
    expiresAt: string
}

// ============================================================================
// SECRET
// ============================================================================

/** HMAC-SHA256 gains nothing from a key shorter than its 256-bit block. */
const MIN_SECRET_LENGTH = 32

class SessionSecretError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'SessionSecretError'
    }
}

/**
 * There is no development fallback here on purpose. A fallback is a shared,
 * public secret, which is the original vulnerability with extra steps -- the
 * same mistake `CRON_SECRET || 'dev-cron-key'` makes in the cron routes today.
 * Missing config fails closed: signing throws, verifying returns null.
 */
function getSecret(): string {
    const secret = process.env.SESSION_SECRET

    if (!secret || secret.length < MIN_SECRET_LENGTH) {
        throw new SessionSecretError(
            `SESSION_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters, ` +
            'so sessions cannot be signed. Generate one with `openssl rand -base64 32` ' +
            'and set it in .env.local and in the deployment environment.'
        )
    }

    return secret
}

/** Re-imported only when the secret changes, which supports key rotation. */
let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null

function getKey(): Promise<CryptoKey> {
    const secret = getSecret()

    if (cachedKey?.secret !== secret) {
        cachedKey = {
            secret,
            key: crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign', 'verify']
            ),
        }
    }

    return cachedKey.key
}

/** A misconfigured deployment logs every request otherwise. */
let secretErrorLogged = false

function reportSecretError(error: unknown): void {
    if (error instanceof SessionSecretError && !secretErrorLogged) {
        secretErrorLogged = true
        console.error(`[session] ${error.message}`)
    }
}

// ============================================================================
// BASE64URL
// ============================================================================

/**
 * `btoa` only accepts Latin-1, and display names are not Latin-1 -- so the
 * bytes are produced by TextEncoder first rather than handing it a JS string.
 * Payloads are well under a kilobyte, so the per-char loop is not a concern.
 */
function toBase64Url(bytes: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * The return type is inferred rather than annotated `Uint8Array`. Since the
 * typed-array types became generic over their backing buffer, a bare
 * `Uint8Array` widens to `Uint8Array<ArrayBufferLike>`, which `crypto.subtle`
 * rejects because it could be a SharedArrayBuffer. Inference keeps the
 * narrower `Uint8Array<ArrayBuffer>` that `new Uint8Array(n)` produces.
 */
function fromBase64Url(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)

    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

function encodeJson(value: unknown): string {
    return toBase64Url(new TextEncoder().encode(JSON.stringify(value)))
}

function decodeJson(value: string): unknown {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(value)))
}

// ============================================================================
// SIGN / VERIFY
// ============================================================================

/**
 * Throws when SESSION_SECRET is absent, which surfaces at sign-in as a failed
 * callback rather than as a session nobody can verify afterwards.
 */
export async function signSession(payload: SessionPayload): Promise<string> {
    const key = await getKey()
    const encodedPayload = encodeJson(payload)

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(encodedPayload)
    )

    return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`
}

/**
 * Returns null for anything this deployment did not issue: a bad signature, a
 * malformed token, an expired payload, or a missing secret. Never throws --
 * callers read null as "signed out".
 */
export async function verifySession(
    token: string | undefined | null
): Promise<SessionPayload | null> {
    if (!token) return null

    const separator = token.indexOf('.')
    if (separator <= 0 || separator === token.length - 1) return null

    const encodedPayload = token.slice(0, separator)
    const encodedSignature = token.slice(separator + 1)
    if (encodedSignature.includes('.')) return null

    try {
        const key = await getKey()

        // `crypto.subtle.verify` compares in constant time. Do not be tempted to
        // re-sign and `===` the two strings; that leaks the signature by timing.
        const valid = await crypto.subtle.verify(
            'HMAC',
            key,
            fromBase64Url(encodedSignature),
            new TextEncoder().encode(encodedPayload)
        )
        if (!valid) return null

        const payload = decodeJson(encodedPayload)
        return isLiveSession(payload) ? payload : null
    } catch (error) {
        reportSecretError(error)
        return null
    }
}

function isLiveSession(value: unknown): value is SessionPayload {
    if (typeof value !== 'object' || value === null) return false

    const candidate = value as Partial<SessionPayload>
    const user = candidate.user

    if (typeof user !== 'object' || user === null) return false
    if (typeof user.id !== 'string' || user.id.length === 0) return false

    // A missing expiry counts as expired, not as "never expires". The old check
    // was `session.expiresAt && new Date(session.expiresAt) < new Date()`, so a
    // payload without the field was accepted forever.
    if (typeof candidate.expiresAt !== 'string') return false

    const expiresAt = Date.parse(candidate.expiresAt)
    return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

// ============================================================================
// OAUTH HANDSHAKE STATE
// ============================================================================

export const OAUTH_STATE_COOKIE_NAME = 'arcyn_oauth_state'
export const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10

export const DEFAULT_REDIRECT_PATH = '/home'

export interface OAuthState {
    nonce: string
    redirectPath: string
}

/**
 * The OAuth `state` parameter is a CSRF token, not a place to stash a redirect.
 * It previously held only `btoa({redirectPath})`, which an attacker can
 * construct, so a victim could be walked through a sign-in that lands them in
 * the attacker's account. Binding it to an httpOnly nonce cookie is what makes
 * it a real check: the attacker cannot set that cookie in the victim's browser.
 */
export function createOAuthNonce(): string {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function encodeOAuthState(state: OAuthState): string {
    return encodeJson(state)
}

export function decodeOAuthState(value: string | null | undefined): OAuthState | null {
    if (!value) return null

    try {
        const parsed = decodeJson(value) as Partial<OAuthState> | null
        if (typeof parsed?.nonce !== 'string' || parsed.nonce.length === 0) return null

        // The redirect is attacker-controlled even with a valid nonce -- the
        // user's own state round-trips through their browser -- so it is
        // re-sanitised on the way back rather than trusted.
        return { nonce: parsed.nonce, redirectPath: safeRedirectPath(parsed.redirectPath) }
    } catch {
        return null
    }
}

export function nonceMatches(a: string | undefined, b: string | undefined): boolean {
    if (!a || !b || a.length !== b.length) return false

    let diff = 0
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return diff === 0
}

/**
 * Keeps `?redirect=` (and the same value coming back through `state`) pointing
 * at this site. `new URL('https://evil.com', request.url)` resolves to
 * evil.com, and `//evil.com` and `/\evil.com` are both protocol-relative once a
 * browser resolves them -- all three turned the callback into an open redirect.
 */
export function safeRedirectPath(value: unknown): string {
    if (typeof value !== 'string') return DEFAULT_REDIRECT_PATH
    if (!value.startsWith('/')) return DEFAULT_REDIRECT_PATH
    if (value.startsWith('//') || value.startsWith('/\\')) return DEFAULT_REDIRECT_PATH
    return value
}
