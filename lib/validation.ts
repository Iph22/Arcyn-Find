/**
 * Validation Module - Backwards Compatibility Layer
 * 
 * This module re-exports validation utilities from the new security module
 * for backwards compatibility with existing code.
 * 
 * DEPRECATED: Prefer importing directly from '@/lib/security'
 * 
 * @deprecated Use imports from '@/lib/security' instead
 */

// Re-export schemas for backwards compatibility
export {
  createCollectionSchema,
  updateCollectionSchema,
  createReviewSchema,
  updateReviewSchema,
  validateBody
} from './security/input-validator'
