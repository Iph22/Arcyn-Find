import { getSupabaseAdmin } from '@/lib/supabase'
import type { ReviewWithProfile, ReviewStats } from '@/lib/types'

/**
 * Reviews Service
 * Handles all business logic for reviews
 */
export class ReviewsService {
  /**
   * Get reviews for a tool or user with pagination
   */
  static async getToolReviews(
    toolId: string | null,
    options: { limit?: number; offset?: number; userId?: string } = {}
  ): Promise<{ reviews: ReviewWithProfile[]; total: number }> {
    const supabase = getSupabaseAdmin()
    const limit = options.limit || 10
    const offset = options.offset || 0

    let query = supabase
      .from('tool_reviews')
      .select(
        `
        *,
        user_profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      `,
        { count: 'exact' }
      )

    if (toolId) {
      query = query.eq('tool_id', toolId)
    }

    if (options.userId) {
      query = query.eq('user_id', options.userId)
    }

    const { data: reviews, error, count } = await query
      .order('helpful_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Handle table not existing gracefully
    if (error) {
      if (error.code === '42P01' || (typeof error.message === 'string' && error.message.includes('does not exist'))) {
        return { reviews: [], total: 0 }
      }
      throw error
    }

    return {
      reviews: (reviews || []) as ReviewWithProfile[],
      total: count || 0,
    }
  }

  /**
   * Calculate review statistics for a tool
   */
  static async getReviewStats(toolId: string): Promise<ReviewStats> {
    const supabase = getSupabaseAdmin()

    const { data: statsData, error: statsError } = await supabase
      .from('tool_reviews')
      .select('rating')
      .eq('tool_id', toolId)

    // Handle stats error gracefully
    if (statsError && statsError.code !== '42P01' && !(typeof statsError.message === 'string' && statsError.message.includes('does not exist'))) {
      // Log but don't throw - return empty stats
      return {
        avg_rating: 0,
        total_reviews: 0,
        rating_distribution: {},
      }
    }

    const stats: ReviewStats = {
      avg_rating: 0,
      total_reviews: statsData?.length || 0,
      rating_distribution: {},
    }

    if (statsData && statsData.length > 0) {
      const total = statsData.length
      const avg = statsData.reduce((sum, r) => sum + r.rating, 0) / total
      stats.avg_rating = Math.round(avg * 10) / 10

      for (let i = 1; i <= 5; i++) {
        stats.rating_distribution[i.toString()] = statsData.filter((r) => r.rating === i).length
      }
    }

    return stats
  }

  /**
   * Create a new review
   */
  static async createReview(
    userId: string,
    data: {
      tool_id: string
      rating: number
      title?: string
      review_text?: string
    }
  ) {
    const supabase = getSupabaseAdmin()

    // Check if user already reviewed this tool
    const { data: existing } = await supabase
      .from('tool_reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('tool_id', data.tool_id)
      .single()

    if (existing) {
      throw new Error('You have already reviewed this tool')
    }

    const { data: review, error } = await supabase
      .from('tool_reviews')
      .insert({
        user_id: userId,
        tool_id: data.tool_id,
        rating: data.rating,
        title: data.title,
        review_text: data.review_text || '',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') {
        throw new Error('Reviews table does not exist')
      }
      throw error
    }

    return review
  }

  /**
   * Update a review
   */
  static async updateReview(
    reviewId: string,
    updates: {
      rating?: number
      title?: string
      review_text?: string
    }
  ) {
    const supabase = getSupabaseAdmin()

    const updateData: {
      rating?: number
      title?: string
      review_text?: string
      updated_at: string
    } = {
      updated_at: new Date().toISOString(),
    }

    if (updates.rating !== undefined) updateData.rating = updates.rating
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.review_text !== undefined) updateData.review_text = updates.review_text

    const { data, error } = await supabase
      .from('tool_reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select()
      .single()

    if (error) throw error

    return data
  }

  /**
   * Delete a review
   */
  static async deleteReview(reviewId: string) {
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('tool_reviews')
      .delete()
      .eq('id', reviewId)

    if (error) throw error
  }

  /**
   * Verify review ownership
   */
  static async verifyOwnership(reviewId: string, userId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('tool_reviews')
      .select('user_id')
      .eq('id', reviewId)
      .single()

    if (error || !data) return false

    return data.user_id === userId
  }

  /**
   * Mark a review as helpful
   */
  static async markAsHelpful(reviewId: string) {
    const supabase = getSupabaseAdmin()

    // Try to use RPC function first
    const { error: rpcError } = await supabase.rpc('increment_helpful_count', {
      review_id: reviewId,
    })

    if (rpcError) {
      // If RPC doesn't exist, do it manually
      const { data: review } = await supabase
        .from('tool_reviews')
        .select('helpful_count')
        .eq('id', reviewId)
        .single()

      if (review) {
        const { error: updateError } = await supabase
          .from('tool_reviews')
          .update({ helpful_count: (review.helpful_count || 0) + 1 })
          .eq('id', reviewId)

        if (updateError) throw updateError
      }
    }
  }
}

