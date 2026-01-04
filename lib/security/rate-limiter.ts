/**
 * Advanced Rate Limiter - OWASP Compliant
 * Implements IP-based and user-based rate limiting with sliding window algorithm
 * 
 * Security Features:
 * - IP-based limiting for unauthenticated requests
 * - User-based limiting for authenticated requests (prevents account abuse)
 * - Sliding window algorithm for smoother rate limiting
 * - Graceful 429 responses with Retry-After headers
 * - Protection against burst attacks
 * 
 * @module security/rate-limiter
 */

import { NextRequest, NextResponse } from 'next/server'
import { ErrorCodes } from '@/lib/api-errors'

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
    /** Maximum requests allowed in the window */
    maxRequests: number
    /** Time window in seconds */
    windowSeconds: number
    /** Optional: Different limits for authenticated users */
    authenticatedMaxRequests?: number
    /** Optional: Burst protection - max requests per second */
    burstLimit?: number
    /** Optional: Custom identifier key prefix */
    keyPrefix?: string
}

export interface RateLimitResult {
    /** Whether the request is allowed */
    allowed: boolean
    /** Remaining requests in current window */
    remaining: number
    /** Timestamp when the rate limit resets (epoch ms) */
    resetTime: number
    /** Total limit for this client */
    limit: number
    /** Time in seconds until reset */
    retryAfterSeconds: number
}

interface RateLimitEntry {
    /** Request timestamps within the current window */
    timestamps: number[]
    /** Last cleanup time */
    lastCleanup: number
}

// ============================================================================
// RATE LIMIT STORE (In-memory for serverless, consider Redis for production)
// ============================================================================

/**
 * In-memory store with sliding window tracking
 * Note: For high-scale production, use Redis or a dedicated rate limiting service
 */
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically (every 5 minutes)
let cleanupInterval: NodeJS.Timeout | null = null

if (typeof global !== 'undefined' && typeof window === 'undefined') {
    cleanupInterval = setInterval(() => {
        const now = Date.now()
        const maxAge = 10 * 60 * 1000 // 10 minutes

        for (const [key, entry] of rateLimitStore.entries()) {
            // Remove entries that haven't been accessed recently
            if (now - entry.lastCleanup > maxAge) {
                rateLimitStore.delete(key)
            }
        }
    }, 5 * 60 * 1000)
}

// ============================================================================
// DEFAULT CONFIGURATIONS (OWASP-recommended sensible defaults)
// ============================================================================

/**
 * Predefined rate limit configurations for different endpoint types
 * Based on OWASP recommendations and common best practices
 */
export const RATE_LIMIT_PRESETS = {
    /** Standard API endpoints - balanced for normal usage */
    STANDARD: {
        maxRequests: 60,
        windowSeconds: 60, // 60 requests per minute
        authenticatedMaxRequests: 100, // Higher limit for authenticated users
        burstLimit: 10,
        keyPrefix: 'std'
    },

    /** Authentication endpoints - strict to prevent brute force */
    AUTH: {
        maxRequests: 5,
        windowSeconds: 60, // 5 attempts per minute
        burstLimit: 2,
        keyPrefix: 'auth'
    },

    /** Search endpoints - moderate limits */
    SEARCH: {
        maxRequests: 30,
        windowSeconds: 60, // 30 searches per minute
        authenticatedMaxRequests: 60,
        burstLimit: 5,
        keyPrefix: 'search'
    },

    /** Write operations (POST, PUT, DELETE) - stricter limits */
    WRITE: {
        maxRequests: 20,
        windowSeconds: 60, // 20 writes per minute
        authenticatedMaxRequests: 40,
        burstLimit: 3,
        keyPrefix: 'write'
    },

    /** Contact/Feedback forms - very strict to prevent spam */
    CONTACT: {
        maxRequests: 3,
        windowSeconds: 60, // 3 submissions per minute
        burstLimit: 1,
        keyPrefix: 'contact'
    },

    /** Expensive operations (trending, cron) - limited */
    EXPENSIVE: {
        maxRequests: 10,
        windowSeconds: 60, // 10 requests per minute
        burstLimit: 2,
        keyPrefix: 'expensive'
    },

    /** Public read-only endpoints - more lenient */
    PUBLIC_READ: {
        maxRequests: 120,
        windowSeconds: 60, // 120 requests per minute
        burstLimit: 20,
        keyPrefix: 'pub'
    }
} as const

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract client identifier from request
 * Prioritizes forwarded headers for proper identification behind proxies
 * 
 * @param request - The incoming request
 * @returns Client IP address or 'unknown'
 */
function getClientIP(request: NextRequest | Request): string {
    // Check various headers (Vercel, Cloudflare, generic)
    const headers = request.headers

    // Vercel / AWS ALB
    const xForwardedFor = headers.get('x-forwarded-for')
    if (xForwardedFor) {
        // Take the first IP (client's actual IP)
        return xForwardedFor.split(',')[0].trim()
    }

    // Cloudflare
    const cfConnectingIP = headers.get('cf-connecting-ip')
    if (cfConnectingIP) {
        return cfConnectingIP.trim()
    }

    // Standard
    const xRealIP = headers.get('x-real-ip')
    if (xRealIP) {
        return xRealIP.trim()
    }

    return 'unknown'
}

/**
 * Generate rate limit key from request context
 * Uses combination of IP, user ID, and endpoint prefix for granular limiting
 */
function generateRateLimitKey(
    request: NextRequest | Request,
    config: RateLimitConfig,
    userId?: string
): string {
    const ip = getClientIP(request)
    const prefix = config.keyPrefix || 'default'

    // User-based limiting takes priority for authenticated requests
    // This prevents a single user from consuming all rate limit quota
    if (userId) {
        return `${prefix}:user:${userId}`
    }

    return `${prefix}:ip:${ip}`
}

/**
 * Clean up old timestamps from the sliding window
 */
function cleanupTimestamps(timestamps: number[], windowMs: number): number[] {
    const now = Date.now()
    const cutoff = now - windowMs
    return timestamps.filter(ts => ts > cutoff)
}

// ============================================================================
// CORE RATE LIMITING FUNCTION
// ============================================================================

/**
 * Check if a request is rate limited using sliding window algorithm
 * 
 * @param request - The incoming request
 * @param config - Rate limit configuration
 * @param userId - Optional user ID for user-based limiting
 * @returns Rate limit result with status and metadata
 */
export function checkRateLimit(
    request: NextRequest | Request,
    config: RateLimitConfig = RATE_LIMIT_PRESETS.STANDARD,
    userId?: string
): RateLimitResult {
    const now = Date.now()
    const windowMs = config.windowSeconds * 1000
    const key = generateRateLimitKey(request, config, userId)

    // Determine the limit based on authentication status
    const limit = userId && config.authenticatedMaxRequests
        ? config.authenticatedMaxRequests
        : config.maxRequests

    // Get or create entry
    let entry = rateLimitStore.get(key)

    if (!entry) {
        entry = {
            timestamps: [],
            lastCleanup: now
        }
        rateLimitStore.set(key, entry)
    }

    // Clean up old timestamps (sliding window)
    entry.timestamps = cleanupTimestamps(entry.timestamps, windowMs)
    entry.lastCleanup = now

    // Check burst limit (requests in the last second)
    if (config.burstLimit) {
        const lastSecond = now - 1000
        const recentRequests = entry.timestamps.filter(ts => ts > lastSecond).length
        if (recentRequests >= config.burstLimit) {
            // Burst limit exceeded
            return {
                allowed: false,
                remaining: 0,
                resetTime: now + 1000, // Reset in 1 second for burst
                limit: config.burstLimit,
                retryAfterSeconds: 1
            }
        }
    }

    // Check rate limit
    const currentCount = entry.timestamps.length

    if (currentCount >= limit) {
        // Rate limit exceeded
        // Find when the oldest request will expire
        const oldestTimestamp = Math.min(...entry.timestamps)
        const resetTime = oldestTimestamp + windowMs
        const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000))

        return {
            allowed: false,
            remaining: 0,
            resetTime,
            limit,
            retryAfterSeconds
        }
    }

    // Request allowed - record timestamp
    entry.timestamps.push(now)
    const remaining = limit - entry.timestamps.length
    const resetTime = now + windowMs

    return {
        allowed: true,
        remaining,
        resetTime,
        limit,
        retryAfterSeconds: Math.ceil(windowMs / 1000)
    }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Generate standardized rate limit headers for responses
 * Follows RFC 6585 and draft-ietf-httpapi-ratelimit-headers conventions
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        'RateLimit-Limit': result.limit.toString(),
        'RateLimit-Remaining': result.remaining.toString(),
        'RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
    }
}

/**
 * Create a graceful 429 Too Many Requests response
 * Follows OWASP best practices for rate limit responses
 */
export function createRateLimitResponse(
    result: RateLimitResult,
    customMessage?: string
): NextResponse {
    const headers = {
        ...getRateLimitHeaders(result),
        'Retry-After': result.retryAfterSeconds.toString(),
        'Content-Type': 'application/json'
    }

    const body = {
        error: 'Too Many Requests',
        message: customMessage || 'You have exceeded the rate limit. Please wait before making more requests.',
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        retryAfter: result.retryAfterSeconds,
        limit: result.limit,
        remaining: 0,
        resetAt: new Date(result.resetTime).toISOString()
    }

    return NextResponse.json(body, {
        status: 429,
        headers
    })
}

// ============================================================================
// MIDDLEWARE HELPER
// ============================================================================

/**
 * Rate limiting middleware wrapper for easy integration
 * Returns null if allowed, or a 429 response if rate limited
 */
export function withRateLimit(
    request: NextRequest | Request,
    config: RateLimitConfig = RATE_LIMIT_PRESETS.STANDARD,
    userId?: string
): NextResponse | null {
    const result = checkRateLimit(request, config, userId)

    if (!result.allowed) {
        return createRateLimitResponse(result)
    }

    return null
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleanup function for graceful shutdown
 */
export function cleanupRateLimiter(): void {
    if (cleanupInterval) {
        clearInterval(cleanupInterval)
        cleanupInterval = null
    }
    rateLimitStore.clear()
}
