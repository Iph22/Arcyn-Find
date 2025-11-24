import type { AIEntry } from './ai-data'
import type { UserProfile } from './auth'

/**
 * Extended AI Entry with optional rating and user data
 */
export interface ToolWithRating extends AIEntry {
  rating?: number
  users?: string
  url?: string
}

/**
 * Collection with tool count
 */
export interface Collection {
  id: string
  user_id: string
  name: string
  description?: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface CollectionWithCount extends Collection {
  tool_count: number
  collection_items?: Array<{ count: number }>
}

/**
 * Review with user profile data
 */
export interface Review {
  id: string
  tool_id: string
  user_id: string
  rating: number
  title?: string | null
  review_text?: string | null
  helpful_count: number
  created_at: string
  updated_at: string
}

export interface ReviewWithProfile extends Review {
  user_profiles?: {
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
}

/**
 * Review statistics
 */
export interface ReviewStats {
  avg_rating: number
  total_reviews: number
  rating_distribution: Record<string, number>
}

/**
 * API Error response
 */
export interface APIError {
  error: string
  code?: string
  details?: unknown
}

/**
 * Standard API response wrapper
 */
export interface APIResponse<T> {
  data: T
  error?: never
}

export type APIResult<T> = APIResponse<T> | APIError

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}


