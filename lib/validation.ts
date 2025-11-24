import { z } from 'zod'

/**
 * Validation schemas for API endpoints
 */

export const createCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  is_public: z.boolean().default(false),
})

export const updateCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  is_public: z.boolean().optional(),
})

export const createReviewSchema = z.object({
  tool_id: z.string().min(1, 'Tool ID is required'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  title: z.string().max(200, 'Title must be less than 200 characters').optional(),
  review_text: z.string().max(2000, 'Review text must be less than 2000 characters').optional(),
  comment: z.string().max(2000).optional(), // Alias for review_text
})

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(200).optional(),
  review_text: z.string().max(2000).optional(),
})

/**
 * Validate request body against schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return { success: false, error: firstError?.message || 'Validation failed' }
    }
    return { success: false, error: 'Invalid request body' }
  }
}

