import { NextResponse } from 'next/server'
import type { APIError } from './types'
import { logger } from './logger'

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: unknown,
  status: number = 500,
  code?: string
): NextResponse<APIError> {
  const apiError: APIError = {
    error: error instanceof Error ? error.message : 'Internal server error',
    code,
    ...(process.env.NODE_ENV === 'development' && { details: error }),
  }

  // Log error for debugging
  if (status >= 500) {
    logger.error('API Error:', error)
  } else {
    logger.warn('API Error (client):', error)
  }

  return NextResponse.json(apiError, { status })
}

/**
 * Create success response with data
 */
export function createSuccessResponse<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const


