/**
 * Secure Configuration Module - OWASP Compliant
 * 
 * Security Features:
 * - All secrets loaded from environment variables
 * - No hardcoded keys or secrets
 * - Runtime validation of required secrets
 * - Client-side exposure prevention
 * - Key rotation support via environment updates
 * 
 * @module security/config
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SecureConfig {
    /** Supabase configuration */
    supabase: {
        url: string
        anonKey: string
        serviceRoleKey: string
    }
    /** Google OAuth configuration */
    google: {
        clientId: string
        clientSecret: string
    }
    /** Site configuration */
    site: {
        url: string
        isProduction: boolean
        isDevelopment: boolean
    }
    /** Optional service configurations */
    services: {
        resendApiKey?: string
        resendFromEmail?: string
        cronSecret?: string
    }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a value looks like a placeholder (not a real secret)
 */
function isPlaceholder(value: string | undefined): boolean {
    if (!value) return true

    const placeholderPatterns = [
        /^your-/i,
        /^placeholder/i,
        /^xxx/i,
        /^test/i,
        /^example/i,
        /^changeme/i,
        /^TODO/i
    ]

    return placeholderPatterns.some(pattern => pattern.test(value))
}

/**
 * Mask a secret for safe logging (show first and last 4 chars)
 */
export function maskSecret(secret: string | undefined): string {
    if (!secret || secret.length < 12) return '***'
    return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`
}

/**
 * Check if we're in the build phase
 */
function isBuildPhase(): boolean {
    return (
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.NEXT_PHASE === 'phase-export' ||
        process.env.npm_lifecycle_event === 'build'
    )
}

// ============================================================================
// ENVIRONMENT VARIABLE GETTERS
// ============================================================================

/**
 * Get a required environment variable
 * Throws during runtime if missing (but not during build)
 */
export function getRequiredEnv(name: string, isServerOnly = true): string {
    const value = process.env[name]

    // During build, return placeholder
    if (isBuildPhase() && !value) {
        return `BUILD_PLACEHOLDER_${name}`
    }

    // Check for missing or placeholder values
    if (!value || isPlaceholder(value)) {
        // In development, warn but don't crash
        if (process.env.NODE_ENV === 'development') {
            console.warn(`[Security] Missing or placeholder ${isServerOnly ? 'server' : ''} env var: ${name}`)
            return value || ''
        }

        // In production, this is a critical error
        throw new Error(`Required environment variable ${name} is not configured`)
    }

    return value
}

/**
 * Get an optional environment variable
 */
export function getOptionalEnv(name: string): string | undefined {
    const value = process.env[name]

    // Return undefined for placeholders
    if (isPlaceholder(value)) {
        return undefined
    }

    return value
}

// ============================================================================
// SECURE CONFIGURATION GETTERS
// ============================================================================

/**
 * Get Supabase configuration
 * Uses anon key for client-side, service role key for server-side admin ops
 */
export function getSupabaseConfig() {
    return {
        url: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', false),
        anonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', false),
        serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY', true)
    }
}

/**
 * Get Google OAuth configuration
 * Client ID is public, client secret is server-only
 */
export function getGoogleOAuthConfig() {
    return {
        clientId: getRequiredEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', false),
        clientSecret: getRequiredEnv('GOOGLE_CLIENT_SECRET', true)
    }
}

/**
 * Get site configuration
 */
export function getSiteConfig() {
    const nodeEnv = process.env.NODE_ENV || 'development'
    return {
        url: getRequiredEnv('NEXT_PUBLIC_SITE_URL', false),
        isProduction: nodeEnv === 'production',
        isDevelopment: nodeEnv === 'development'
    }
}

/**
 * Get optional service configurations
 */
export function getServiceConfigs() {
    return {
        resendApiKey: getOptionalEnv('RESEND_API_KEY'),
        resendFromEmail: getOptionalEnv('RESEND_FROM_EMAIL'),
        cronSecret: getOptionalEnv('CRON_SECRET')
    }
}

// ============================================================================
// RUNTIME SECURITY CHECKS
// ============================================================================

/**
 * List of environment variable names that should NEVER be exposed to clients
 * These contain sensitive secrets and should only be used server-side
 */
export const SERVER_ONLY_SECRETS = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLIENT_SECRET',
    'RESEND_API_KEY',
    'CRON_SECRET',
    // Add any other server-only secrets here
] as const

/**
 * Validate that no server-only secrets are exposed in the client bundle
 * Call this in development to catch accidental exposures
 */
export function validateNoClientExposure(): void {
    if (typeof window !== 'undefined') {
        // We're on the client side
        for (const secretName of SERVER_ONLY_SECRETS) {
            // Check if any secret is accidentally in window or global scope
            // @ts-expect-error - checking for accidental exposure
            if (typeof window[secretName] !== 'undefined') {
                console.error(`[CRITICAL SECURITY] Server secret ${secretName} exposed to client!`)
            }
        }

        // Check for NEXT_PUBLIC_ prefixed secrets (which would be exposed)
        for (const secretName of SERVER_ONLY_SECRETS) {
            const publicName = `NEXT_PUBLIC_${secretName}`
            if (process.env[publicName]) {
                console.error(`[CRITICAL SECURITY] Server secret incorrectly prefixed with NEXT_PUBLIC_: ${secretName}`)
            }
        }
    }
}

/**
 * Verify all required environment variables are configured
 * Call this during app startup
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
    const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'NEXT_PUBLIC_SITE_URL'
    ]

    const missing: string[] = []

    for (const varName of requiredVars) {
        if (!process.env[varName] || isPlaceholder(process.env[varName])) {
            missing.push(varName)
        }
    }

    return {
        valid: missing.length === 0,
        missing
    }
}

// ============================================================================
// CRON/WEBHOOK AUTHENTICATION
// ============================================================================

/**
 * Verify cron job authorization
 * Checks for valid Bearer token matching CRON_SECRET
 */
export function verifyCronAuthorization(authHeader: string | null): boolean {
    const cronSecret = getOptionalEnv('CRON_SECRET')

    // If no secret configured, allow in development only
    if (!cronSecret) {
        return process.env.NODE_ENV === 'development'
    }

    // Verify Bearer token
    if (!authHeader?.startsWith('Bearer ')) {
        return false
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(token, cronSecret)
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get full secure configuration object
 * Should only be called server-side
 */
export function getSecureConfig(): SecureConfig {
    return {
        supabase: getSupabaseConfig(),
        google: getGoogleOAuthConfig(),
        site: getSiteConfig(),
        services: getServiceConfigs()
    }
}

// Development-time validation
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
    const validation = validateEnvironment()
    if (!validation.valid) {
        console.warn('[Security] Missing required environment variables:', validation.missing.join(', '))
    }
}
