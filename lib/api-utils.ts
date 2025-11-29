/**
 * API Utilities
 * Reusable utilities for API route handlers
 */

import { logger } from './logger'
import { createErrorResponse, createSuccessResponse } from './api-errors'
import type { NextRequest, NextResponse } from 'next/server'

/**
 * Safe API call wrapper that handles errors gracefully
 */
export async function safeApiCall<T>(
  fn: () => Promise<T>,
  errorMessage: string = 'Operation failed'
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn()
    return { data, error: null }
  } catch (error) {
    logger.error(errorMessage, error)
    return {
      data: null,
      error: error instanceof Error ? error.message : errorMessage
    }
  }
}

/**
 * Parse JSON request body with error handling
 */
export async function parseRequestBody<T = unknown>(
  request: NextRequest
): Promise<{ data: T | null; error: string | null }> {
  try {
    const body = await request.json()
    return { data: body as T, error: null }
  } catch (error) {
    logger.error('Error parsing request body:', error)
    return {
      data: null,
      error: 'Invalid request body. Expected JSON.'
    }
  }
}

/**
 * Handle async API route with standard error handling
 */
export function withErrorHandling<T>(
  handler: (request: NextRequest, context?: unknown) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse<T>> => {
    try {
      return await handler(request, context)
    } catch (error) {
      logger.error('Unhandled error in API route:', error)
      return createErrorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500,
        'INTERNAL_ERROR'
      ) as NextResponse<T>
    }
  }
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: Record<string, unknown>,
  fields: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields = fields.filter(field => {
    const value = body[field]
    return value === undefined || value === null || value === ''
  })

  return {
    valid: missingFields.length === 0,
    missingFields
  }
}

/**
 * Extract query parameter with default value
 */
export function getQueryParam(
  request: NextRequest,
  key: string,
  defaultValue: string | null = null
): string | null {
  const value = request.nextUrl.searchParams.get(key)
  return value ?? defaultValue
}

/**
 * Extract query parameter as number with default value
 */
export function getQueryParamAsNumber(
  request: NextRequest,
  key: string,
  defaultValue: number | null = null
): number | null {
  const value = request.nextUrl.searchParams.get(key)
  if (!value) return defaultValue
  
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

/**
 * Extract query parameter as boolean
 */
export function getQueryParamAsBoolean(
  request: NextRequest,
  key: string,
  defaultValue: boolean = false
): boolean {
  const value = request.nextUrl.searchParams.get(key)
  if (!value) return defaultValue
  
  return value.toLowerCase() === 'true'
}

