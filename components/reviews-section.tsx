"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Star, ThumbsUp, Edit, Trash2, User, AlertCircle } from "lucide-react"
import { getToolReviews, getToolReviewStats, submitReview, updateReview, deleteReview, voteReviewHelpful, type Review, type ReviewStats } from "@/lib/reviews"
import { getCurrentUser } from "@/lib/auth"
import { AuthModal } from "@/components/auth-modal"

interface ReviewsSectionProps {
  toolId: string
}

export function ReviewsSection({ toolId }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [formData, setFormData] = useState({
    rating: 5,
    title: '',
    review_text: '',
  })

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (toolId) {
      loadReviews()
    }
  }, [toolId, user])

  const loadUser = async () => {
    const currentUser = await getCurrentUser()
    setUser(currentUser)
  }

  const loadReviews = async () => {
    setLoading(true)
    try {
      const [reviewsData, statsData] = await Promise.all([
        getToolReviews(toolId, user?.id),
        getToolReviewStats(toolId),
      ])
      setReviews(reviewsData.reviews)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      alert('Please log in to submit a review')
      return
    }

    const result = editingReview
      ? await updateReview(editingReview.id, formData.rating, formData.title, formData.review_text)
      : await submitReview(toolId, formData.rating, formData.title, formData.review_text)

    if (result.success) {
      setShowForm(false)
      setEditingReview(null)
      setFormData({ rating: 5, title: '', review_text: '' })
      loadReviews()
    } else {
      alert(result.error || 'Failed to submit review')
    }
  }

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return

    const result = await deleteReview(reviewId)
    if (result.success) {
      loadReviews()
    } else {
      alert(result.error || 'Failed to delete review')
    }
  }

  const handleVote = async (reviewId: string, isHelpful: boolean) => {
    if (!user) {
      alert('Please log in to vote')
      return
    }

    const result = await voteReviewHelpful(reviewId, isHelpful)
    if (result.success) {
      loadReviews()
    }
  }

  const startEdit = (review: Review) => {
    setEditingReview(review)
    setFormData({
      rating: review.rating,
      title: review.title || '',
      review_text: review.review_text || '',
    })
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="mt-8">
        <div className="h-64 animate-pulse rounded-xl border border-border/50 bg-card/50" />
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Stats Section */}
      {stats && stats.total_reviews > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border/50 bg-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                <span className="text-3xl font-bold">{stats.avg_rating}</span>
                <span className="text-muted-foreground">/ 5</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on {stats.total_reviews} {stats.total_reviews === 1 ? 'review' : 'reviews'}
              </p>
            </div>
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center gap-2 text-sm">
                  <span className="w-8">{rating}</span>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400"
                      style={{
                        width: `${((stats.rating_distribution[rating.toString()] || 0) / stats.total_reviews) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground w-8 text-right">
                    {stats.rating_distribution[rating.toString()] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Write Review Button */}
      {user && !showForm && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowForm(true)}
          className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          Write a Review
        </motion.button>
      )}

      {/* Review Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border/50 bg-card p-6"
        >
          <h3 className="text-xl font-bold mb-4">
            {editingReview ? 'Edit Review' : 'Write a Review'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating })}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        rating <= formData.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Title (optional)</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="Brief summary of your review"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Review</label>
              <textarea
                value={formData.review_text}
                onChange={(e) => setFormData({ ...formData, review_text: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 min-h-[120px]"
                placeholder="Share your experience with this tool..."
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent/90"
              >
                {editingReview ? 'Update Review' : 'Submit Review'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingReview(null)
                  setFormData({ rating: 5, title: '', review_text: '' })
                }}
                className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border/50 bg-card p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                    {review.user?.avatar_url ? (
                      <img
                        src={review.user.avatar_url}
                        alt={review.user.display_name || review.user.username || 'User'}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <User className="h-5 w-5 text-accent" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {review.user?.display_name || review.user?.username || 'Anonymous'}
                    </p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <Star
                          key={rating}
                          className={`h-4 w-4 ${
                            rating <= review.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                {user?.id === review.user_id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(review)}
                      className="rounded-lg p-2 hover:bg-muted transition-colors"
                      title="Edit review"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(review.id)}
                      className="rounded-lg p-2 hover:bg-muted transition-colors text-red-400"
                      title="Delete review"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {review.title && (
                <h4 className="font-semibold mb-2">{review.title}</h4>
              )}
              <p className="text-muted-foreground mb-3 whitespace-pre-wrap">{review.review_text}</p>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleVote(review.id, !review.user_vote_helpful)}
                  disabled={!user || review.user_id === user.id}
                  className={`flex items-center gap-2 text-sm transition-colors ${
                    review.user_vote_helpful
                      ? 'text-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  } ${!user || review.user_id === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <ThumbsUp className="h-4 w-4" />
                  <span>Helpful ({review.helpful_count})</span>
                </button>
                <span className="text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="signin"
      />
    </div>
  )
}

