/**
 * Security Module Index
 * Centralized exports for all security-related utilities
 * 
 * @module security
 */

// Rate Limiting
export {
    checkRateLimit,
    withRateLimit,
    createRateLimitResponse,
    getRateLimitHeaders,
    cleanupRateLimiter,
    RATE_LIMIT_PRESETS,
    type RateLimitConfig,
    type RateLimitResult
} from './rate-limiter'

// Input Validation
export {
    // Sanitization utilities
    sanitizeHtml,
    sanitizeForQuery,
    sanitizePath,
    stripUnexpectedFields,

    // Zod validators
    safeString,
    safeEmail,
    safeUrl,
    safeUUID,
    safeId,
    safeUsername,
    safeDisplayName,
    safeBio,
    safeSearchQuery,
    safeRating,
    safePaginationLimit,
    safePaginationOffset,

    // Pre-built schemas
    createCollectionSchema,
    updateCollectionSchema,
    createReviewSchema,
    updateReviewSchema,
    updateProfileSchema,
    contactFormSchema,
    toolIdSchema,
    userSearchSchema,
    paginationSchema,
    trackViewSchema,

    // Validation helpers
    validateBody,
    validateQueryParams,
    parseAndValidateBody,
    validateContentType,
    extractPaginationParams,

    type ValidationResult
} from './input-validator'

// Secure Configuration
export {
    getSecureConfig,
    getSupabaseConfig,
    getGoogleOAuthConfig,
    getSiteConfig,
    getServiceConfigs,
    getRequiredEnv,
    getOptionalEnv,
    maskSecret,
    verifyCronAuthorization,
    validateEnvironment,
    validateNoClientExposure,
    SERVER_ONLY_SECRETS,
    type SecureConfig
} from './config'
