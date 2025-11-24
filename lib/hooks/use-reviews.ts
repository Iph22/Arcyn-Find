"use client"

import { useState, useCallback } from "react"
// Auth handled by API routes

interface Review {
  id: string
  user_id: string
  tool_id: string
  rating: number
  comment: string
  helpful_count: number
  created_at: string
  user?: {
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

export function useReviews(toolId: string) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReviews = useCallback(async () => {
    if (!toolId) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/reviews?toolId=${toolId}`)
      if (!response.ok) throw new Error("Failed to fetch reviews")
      const data = await response.json()
      setReviews(data.reviews || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch reviews")
    } finally {
      setIsLoading(false)
    }
  }, [toolId])

  const submitReview = useCallback(
    async (rating: number, comment: string) => {
      setIsLoading(true)
      setError(null)
      try {
        // Auth handled by API route
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool_id: toolId,
            rating,
            comment,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to submit review")
        }

        await fetchReviews()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to submit review"
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [toolId, fetchReviews]
  )

  const markHelpful = useCallback(
    async (reviewId: string) => {
      try {
        const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
          method: "POST",
        })

        if (!response.ok) throw new Error("Failed to mark helpful")
        await fetchReviews()
      } catch (err) {
        // Silently fail - helpful marking is not critical
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error("Failed to mark helpful:", err)
        }
      }
    },
    [fetchReviews]
  )

  return {
    reviews,
    isLoading,
    error,
    fetchReviews,
    submitReview,
    markHelpful,
  }
}

