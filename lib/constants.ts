/**
 * Application Constants
 * Centralized location for magic numbers and configuration values
 */

export const PAGINATION = {
  INITIAL_LIMIT: 24,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

export const DEBOUNCE = {
  SEARCH: 500,
  API_CALL: 300,
  USER_SEARCH: 300,
} as const

export const RATE_LIMITS = {
  SEARCH: { requests: 10, window: 60 },
  REVIEWS: { requests: 5, window: 60 },
  API: { requests: 100, window: 60 },
} as const

export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB in bytes
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const

export const VALIDATION = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  DISPLAY_NAME_MAX_LENGTH: 100,
  BIO_MAX_LENGTH: 500,
  SEARCH_MIN_LENGTH: 2,
} as const

export const CACHE = {
  API_RESPONSE: 60, // seconds
  STALE_WHILE_REVALIDATE: 300, // seconds
} as const

