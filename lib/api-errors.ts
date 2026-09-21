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
    // A string argument is deliberate, caller-authored copy meant for the
    // client -- 'Unauthorized', 'Collection not found', and the field-level
    // text `parseAndValidateBody` builds out of the Zod issue. Around 55 call
    // sites pass one, and every one of them used to be flattened into
    // 'Internal server error': a 400 that read like a 500, with the real
    // reason surviving only in `details`, which is development-only. A user
    // who mistyped their email was told the server had broken.
    //
    // Anything that is not a string or an Error is still masked, so an
    // unexpected throw cannot leak its internals through this path.
    error:
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Internal server error',
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


