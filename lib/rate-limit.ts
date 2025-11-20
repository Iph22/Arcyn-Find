/**
 * Simple in-memory rate limiter for API routes
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitStore {
    [key: string]: {
        count: number
        resetTime: number
    }
}

const store: RateLimitStore = {}

// Clean up old entries every 5 minutes
let cleanupInterval: NodeJS.Timeout | null = null

// Initialize cleanup interval only in Node.js environment (server-side)
if (typeof global !== 'undefined' && typeof window === 'undefined') {
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    Object.keys(store).forEach((key) => {
      if (store[key].resetTime < now) {
        delete store[key]
      }
    })
  }, 5 * 60 * 1000)
}

/**
 * Cleanup function for graceful shutdown
 * Call this when shutting down the server (e.g., in a cleanup handler)
 */
export function cleanupRateLimit(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    windowMs: number // Time window in milliseconds
    maxRequests: number // Maximum requests per window
}

const DEFAULT_CONFIG: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
}

/**
 * Get client identifier from request
 */
function getClientId(request: Request): string {
    // Try to get IP from headers (works on Vercel and most platforms)
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0] || realIp || 'unknown'

    return ip
}

/**
 * Check if request should be rate limited
 * @returns { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(
    request: Request,
    config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetTime: number } {
    const clientId = getClientId(request)
    const now = Date.now()

    // Get or create entry for this client
    let entry = store[clientId]

    if (!entry || entry.resetTime < now) {
        // Create new entry or reset expired one
        entry = {
            count: 0,
            resetTime: now + config.windowMs,
        }
        store[clientId] = entry
    }

    // Increment count
    entry.count++

    const allowed = entry.count <= config.maxRequests
    const remaining = Math.max(0, config.maxRequests - entry.count)

    return {
        allowed,
        remaining,
        resetTime: entry.resetTime,
    }
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(
    remaining: number,
    resetTime: number
): Record<string, string> {
    return {
        'X-RateLimit-Limit': DEFAULT_CONFIG.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
    }
}

