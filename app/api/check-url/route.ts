/**
 * Check URL API Route - Security Hardened
 * 
 * Security Features:
 * - Rate limiting to prevent abuse
 * - URL validation and sanitization
 * - Protocol restriction (http/https only)
 * - Prevents SSRF attacks by restricting to public URLs
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  safeUrl
} from '@/lib/security'
import { logger } from '@/lib/logger'

// List of blocked IP ranges/hostnames to prevent SSRF
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '10.',           // Private network
  '172.16.',       // Private network
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',      // Private network
  'metadata.',     // Cloud metadata endpoints
  '169.254.',      // Link-local addresses (AWS metadata)
]

/**
 * Check if URL points to a potentially dangerous internal address
 * Helps prevent SSRF (Server-Side Request Forgery) attacks
 */
function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // Check against blocked hosts
    for (const blocked of BLOCKED_HOSTS) {
      if (hostname === blocked || hostname.startsWith(blocked)) {
        return true
      }
    }

    // Block file:// and other non-http protocols (already handled by safeUrl, but double-check)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return true
    }

    return false
  } catch {
    return true // If we can't parse it, block it
  }
}

/**
 * API route to check if a URL is accessible
 * Used by tool health monitoring to bypass CORS restrictions
 */
export async function GET(request: NextRequest) {
  // =========================================================================
  // RATE LIMITING - Moderate limits
  // =========================================================================
  const rateLimit = checkRateLimit(request, {
    maxRequests: 20,
    windowSeconds: 60,
    burstLimit: 5,
    keyPrefix: 'url-check'
  })

  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit)
  }

  // =========================================================================
  // INPUT VALIDATION
  // =========================================================================
  const urlParam = request.nextUrl.searchParams.get('url')

  if (!urlParam) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    )
  }

  // Validate URL format using Zod
  const urlValidation = safeUrl.safeParse(urlParam)

  if (!urlValidation.success) {
    return NextResponse.json(
      { error: 'Invalid URL format. Only http and https URLs are allowed.' },
      { status: 400 }
    )
  }

  const url = urlValidation.data

  // safeUrl transforms empty strings to null - check for that
  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    )
  }

  // =========================================================================
  // SSRF PREVENTION - Block internal/private URLs
  // =========================================================================
  if (isBlockedUrl(url)) {
    logger.warn('[CheckURL] Blocked potentially malicious URL:', url)
    return NextResponse.json(
      { error: 'URL not allowed for security reasons' },
      { status: 403 }
    )
  }

  // =========================================================================
  // CHECK URL
  // =========================================================================
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      // Don't follow too many redirects
      redirect: 'follow',
    })

    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    const result = NextResponse.json({
      status: response.ok ? 'up' : 'down',
      responseTime,
      statusCode: response.status,
    })

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      result.headers.set(key, value)
    })

    return result
  } catch (error) {
    const responseTime = Date.now() - startTime

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({
        status: 'down',
        error: 'Request timeout',
        responseTime,
      })
    }

    return NextResponse.json({
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime,
    })
  }
}
