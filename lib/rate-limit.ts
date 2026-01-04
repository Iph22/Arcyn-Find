/**
 * Rate Limit Module - Backwards Compatibility Layer
 * 
 * This module re-exports rate limiting utilities from the new security module
 * for backwards compatibility with existing code.
 * 
 * DEPRECATED: Prefer importing directly from '@/lib/security'
 * 
 * @deprecated Use imports from '@/lib/security' instead
 */

import {
    checkRateLimit as newCheckRateLimit,
    getRateLimitHeaders as newGetRateLimitHeaders,
    type RateLimitConfig as NewRateLimitConfig,
    type RateLimitResult
} from './security/rate-limiter'

// Legacy interface for backwards compatibility
export interface RateLimitConfig {
    windowMs: number
    maxRequests: number
}

/**
 * Legacy checkRateLimit function - converts old config format to new
 * @deprecated Use checkRateLimit from '@/lib/security' instead
 */
export function checkRateLimit(
    request: Request,
    config: RateLimitConfig = { windowMs: 60 * 1000, maxRequests: 60 }
): { allowed: boolean; remaining: number; resetTime: number } {
    // Convert legacy config to new format
    const newConfig: NewRateLimitConfig = {
        maxRequests: config.maxRequests,
        windowSeconds: Math.ceil(config.windowMs / 1000)
    }

    const result = newCheckRateLimit(request, newConfig)

    return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetTime: result.resetTime
    }
}

/**
 * Legacy getRateLimitHeaders function
 * @deprecated Use getRateLimitHeaders from '@/lib/security' instead
 */
export function getRateLimitHeaders(
    remaining: number,
    resetTime: number
): Record<string, string> {
    const result: RateLimitResult = {
        allowed: true,
        remaining,
        resetTime,
        limit: 60, // Default
        retryAfterSeconds: Math.ceil((resetTime - Date.now()) / 1000)
    }

    return newGetRateLimitHeaders(result)
}

/**
 * Cleanup function
 * @deprecated Use cleanupRateLimiter from '@/lib/security' instead
 */
export { cleanupRateLimiter as cleanupRateLimit } from './security/rate-limiter'
