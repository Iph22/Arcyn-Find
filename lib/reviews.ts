import { supabase } from './supabase'
import { auth } from '@clerk/nextjs/server'

export interface Review {
  id: string
  tool_id: string
  user_id: string
  rating: number
  title?: string
  review_text?: string
  helpful_count: number
  created_at: string
  updated_at: string
  user?: {
    username?: string
    display_name?: string
    avatar_url?: string
  }
  user_has_voted?: boolean
  user_vote_helpful?: boolean
}

export interface ReviewStats {
  avg_rating: number
  total_reviews: number
  rating_distribution: Record<string, number>
}

/**
 * Get reviews for a tool
 */
export async function getToolReviews(
  toolId: string,
  userId?: string,
  limit: number = 10,
  offset: number = 0
): Promise<{ reviews: Review[]; total: number }> {
  try {
    // Get reviews with user profiles
    const { data: reviews, error, count } = await supabase
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
      .eq('tool_id', toolId)
      .order('helpful_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      // Check if it's a table doesn't exist error first
      const err = error as any
      const errorCode = err?.code
      const errorMessage = err?.message || String(error)
      
      if (errorCode === '42P01' || 
          (typeof errorMessage === 'string' && (
            errorMessage.includes('does not exist') || 
            (errorMessage.includes('relation') && errorMessage.includes('does not exist'))
          ))) {
        console.warn('Reviews table does not exist. Please run the database schema.')
        return { reviews: [], total: 0 }
      }
      
      // Log detailed error information - Supabase errors have specific structure
      const errorInfo: Record<string, any> = {
        type: 'SupabaseError',
        message: errorMessage,
      }
      
      // Try to extract properties from error object
      try {
        if (error && typeof error === 'object') {
          // Check for PostgREST error properties
          if (err.code !== undefined) errorInfo.code = err.code
          if (err.details !== undefined) errorInfo.details = err.details
          if (err.hint !== undefined) errorInfo.hint = err.hint
          
          // Try to get all enumerable properties
          try {
            const props = Object.keys(err)
            if (props.length > 0) {
              props.forEach(prop => {
                try {
                  const value = err[prop]
                  if (value !== undefined && value !== null) {
                    errorInfo[prop] = value
                  }
                } catch {
                  // Skip non-serializable properties
                }
              })
            }
          } catch {
            // If we can't enumerate, try stringify
            try {
              errorInfo.raw = JSON.stringify(error, null, 2)
            } catch {
              errorInfo.raw = String(error)
            }
          }
        }
      } catch (e) {
        errorInfo.fallback = String(error)
        errorInfo.extractionError = String(e)
      }
      
      // Only log if we have meaningful information
      if (Object.keys(errorInfo).length > 1) {
        console.error('Supabase query error:', errorInfo)
      } else {
        console.error('Supabase query error:', error)
      }
      
      // Return empty results instead of throwing for better UX
      return { reviews: [], total: 0 }
    }

    // Get user votes if authenticated
    let userVotes: Record<string, boolean> = {}
    if (userId) {
      const reviewIds = reviews?.map(r => r.id) || []
      if (reviewIds.length > 0) {
        const { data: votes, error: votesError } = await supabase
          .from('review_helpful_votes')
          .select('review_id, is_helpful')
          .eq('user_id', userId)
          .in('review_id', reviewIds)

        // Silently ignore votes errors (table might not exist)
        if (!votesError && votes) {
          userVotes = votes.reduce((acc, vote) => {
            acc[vote.review_id] = vote.is_helpful
            return acc
          }, {} as Record<string, boolean>)
        }
      }
    }

    const formattedReviews: Review[] = (reviews || []).map((review: any) => ({
      id: review.id,
      tool_id: review.tool_id,
      user_id: review.user_id,
      rating: review.rating,
      title: review.title,
      review_text: review.review_text,
      helpful_count: review.helpful_count || 0,
      created_at: review.created_at,
      updated_at: review.updated_at,
      user: review.user_profiles ? {
        username: review.user_profiles.username,
        display_name: review.user_profiles.display_name,
        avatar_url: review.user_profiles.avatar_url,
      } : undefined,
      user_has_voted: userId ? review.id in userVotes : false,
      user_vote_helpful: userId ? userVotes[review.id] : undefined,
    }))

    return {
      reviews: formattedReviews,
      total: count || 0,
    }
  } catch (error) {
    // Log detailed error information
    const errorDetails: Record<string, any> = {
      type: 'CatchError',
    }
    
    try {
      if (error instanceof Error) {
        errorDetails.message = error.message
        errorDetails.name = error.name
        if (error.stack) errorDetails.stack = error.stack
      } else if (error && typeof error === 'object') {
        // Try to extract properties from error object
        const err = error as any
        // Try direct property access first
        if (err.message !== undefined) errorDetails.message = err.message
        if (err.code !== undefined) errorDetails.code = err.code
        if (err.details !== undefined) errorDetails.details = err.details
        if (err.hint !== undefined) errorDetails.hint = err.hint
        
        // Try to get all enumerable properties
        try {
          const props = Object.keys(err)
          if (props.length > 0) {
            props.forEach(prop => {
              try {
                const value = err[prop]
                if (value !== undefined && value !== null) {
                  errorDetails[prop] = value
                }
              } catch {
                // Skip non-serializable properties
              }
            })
          }
        } catch {
          errorDetails.raw = String(error)
        }
      } else {
        errorDetails.raw = String(error)
      }
    } catch (e) {
      errorDetails.fallback = String(error)
      errorDetails.extractionError = String(e)
    }
    
    // Only log if we have meaningful information
    if (Object.keys(errorDetails).length > 1) {
      console.error('Error fetching reviews:', errorDetails)
    } else {
      console.error('Error fetching reviews:', error)
    }
    
    // If it's a table doesn't exist error, return empty gracefully
    if (error && typeof error === 'object') {
      const err = error as any
      const errorCode = err?.code
      const errorMessage = err?.message || String(error)
      
      if (errorCode === '42P01' || 
          (typeof errorMessage === 'string' && (
            errorMessage.includes('does not exist') || 
            (errorMessage.includes('relation') && errorMessage.includes('does not exist'))
          ))) {
        console.warn('Reviews table does not exist. Please run the database schema.')
        return { reviews: [], total: 0 }
      }
    }
    
    // Return empty results gracefully instead of crashing
    return { reviews: [], total: 0 }
  }
}

/**
 * Get review statistics for a tool
 */
export async function getToolReviewStats(toolId: string): Promise<ReviewStats | null> {
  try {
    const { data, error } = await supabase
      .from('tool_reviews')
      .select('rating')
      .eq('tool_id', toolId)

    if (error) {
      // Log detailed error information - Supabase errors have specific structure
      const errorInfo: Record<string, any> = {
        type: 'SupabaseStatsError',
      }
      
      try {
        if (error && typeof error === 'object') {
          const err = error as any
          // Try direct property access first
          if (err.message !== undefined) errorInfo.message = err.message
          if (err.details !== undefined) errorInfo.details = err.details
          if (err.hint !== undefined) errorInfo.hint = err.hint
          if (err.code !== undefined) errorInfo.code = err.code
          
          // If we still have nothing, try to get all properties
          if (Object.keys(errorInfo).length === 1) {
            try {
              const props = Object.getOwnPropertyNames(error)
              props.forEach(prop => {
                try {
                  const value = (error as any)[prop]
                  if (value !== undefined) {
                    errorInfo[prop] = value
                  }
                } catch {
                  // Skip non-serializable properties
                }
              })
            } catch {
              errorInfo.raw = String(error)
            }
          }
        } else {
          errorInfo.raw = String(error)
        }
      } catch (e) {
        errorInfo.fallback = String(error)
      }
      
      console.error('Supabase stats query error:', errorInfo)
      
      // If table doesn't exist, return null gracefully
      const err = error as any
      const errorCode = err?.code
      const errorMessage = err?.message
      if (errorCode === '42P01' || 
          (typeof errorMessage === 'string' && (
            errorMessage.includes('does not exist') || 
            (errorMessage.includes('relation') && errorMessage.includes('does not exist'))
          ))) {
        console.warn('Reviews table does not exist. Please run the database schema.')
        return null
      }
      throw error
    }

    const reviews = data || []
    if (reviews.length === 0) {
      return {
        avg_rating: 0,
        total_reviews: 0,
        rating_distribution: {},
      }
    }

    const total = reviews.length
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / total
    const distribution: Record<string, number> = {}

    for (let i = 1; i <= 5; i++) {
      distribution[i.toString()] = reviews.filter(r => r.rating === i).length
    }

    return {
      avg_rating: Math.round(avg * 10) / 10,
      total_reviews: total,
      rating_distribution: distribution,
    }
  } catch (error) {
    console.error('Error fetching review stats:', error)
    return null
  }
}

/**
 * Submit a review
 */
export async function submitReview(
  toolId: string,
  rating: number,
  title?: string,
  reviewText?: string
): Promise<{ success: boolean; review?: Review; error?: string }> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'You must be logged in to submit a review' }
    }

    const { data, error } = await supabase
      .from('tool_reviews')
      .insert({
        tool_id: toolId,
        user_id: userId,
        rating,
        title: title || null,
        review_text: reviewText || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return { success: false, error: 'You have already reviewed this tool' }
      }
      throw error
    }

    return { success: true, review: data as Review }
  } catch (error: any) {
    console.error('Error submitting review:', error)
    return { success: false, error: error.message || 'Failed to submit review' }
  }
}

/**
 * Update a review
 */
export async function updateReview(
  reviewId: string,
  rating: number,
  title?: string,
  reviewText?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'You must be logged in' }
    }

    const { error } = await supabase
      .from('tool_reviews')
      .update({
        rating,
        title: title || null,
        review_text: reviewText || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .eq('user_id', userId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error updating review:', error)
    return { success: false, error: error.message || 'Failed to update review' }
  }
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'You must be logged in' }
    }

    const { error } = await supabase
      .from('tool_reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting review:', error)
    return { success: false, error: error.message || 'Failed to delete review' }
  }
}

/**
 * Vote on review helpfulness
 */
export async function voteReviewHelpful(
  reviewId: string,
  isHelpful: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'You must be logged in to vote' }
    }

    const { error } = await supabase
      .from('review_helpful_votes')
      .upsert({
        review_id: reviewId,
        user_id: userId,
        is_helpful: isHelpful,
      }, {
        onConflict: 'review_id,user_id',
      })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error voting on review:', error)
    return { success: false, error: error.message || 'Failed to vote' }
  }
}

