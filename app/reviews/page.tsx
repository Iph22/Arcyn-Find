"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, Star, ThumbsUp, MessageSquare, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguagePicker } from "@/components/language-picker"
import { EmptyState } from "@/components/empty-state"
import { useAuth } from "@/contexts/auth-context"
import { logger } from "@/lib/logger"
import { formatDistanceToNow } from "date-fns"
import type { ReviewWithProfile } from "@/lib/types"

export default function ReviewsPage() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Hidden by default on mobile
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([])
  const [isLoadingReviews, setIsLoadingReviews] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, isAuthLoading, router])

  useEffect(() => {
    if (user?.id) {
      fetchUserReviews(user.id)
    }
  }, [user])

  const displayedReviews = reviews.slice(0, 20)

  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const fetchUserReviews = async (userId: string) => {
    setIsLoadingReviews(true)
    setError(null)
    try {
      const response = await fetch(`/api/reviews?userId=${userId}&limit=100`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch reviews")
      }
      const data = await response.json()
      setReviews(data.reviews || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch reviews"
      setError(errorMessage)
      logger.error("Error fetching user reviews:", err)
    } finally {
      setIsLoadingReviews(false)
    }
  }

  const handleMarkHelpful = async (reviewId: string) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Failed to mark helpful")
      // Refresh reviews
      if (user?.id) {
        await fetchUserReviews(user.id)
      }
    } catch (err) {
      logger.error("Failed to mark helpful:", err)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return dateString
    }
  }

  const getUserInitials = (review: ReviewWithProfile) => {
    const displayName = review.user_profiles?.display_name || review.user_profiles?.username || "User"
    return displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }


  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Hidden on mobile */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <>
            {/* Mobile overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
            />
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-40 h-full w-72"
            >
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden pb-20 md:pb-0">
        {/* Header */}
        <motion.header
          className="border-b border-border/40 bg-card/50 backdrop-blur-xl"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-10 w-10">
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <div className="flex items-center gap-2">

                <span className="text-lg font-bold">Reviews</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguagePicker />
              <ThemeToggle />
            </div>
          </div>
        </motion.header>

        {/* Reviews Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-8">
            {/* Page Title */}
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h1 className="mb-2 text-4xl font-bold">My Reviews</h1>
              <p className="text-lg text-muted-foreground">Share your experiences with AI tools</p>
            </motion.div>

            {/* Reviews List */}
            {isLoadingReviews ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <EmptyState
                icon={MessageSquare}
                title="Error loading reviews"
                description={error}
                action={{
                  label: "Try again",
                  onClick: () => user?.id && fetchUserReviews(user.id),
                }}
              />
            ) : reviews.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No reviews yet"
                description="You haven't reviewed any tools yet. Start exploring and share your experiences!"
                action={{
                  label: "Explore Tools",
                  onClick: () => router.push("/tools"),
                }}
              />
            ) : (
              <div className="space-y-6">
                {reviews.map((review, index) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-md">
                      <div className="p-6">
                        {/* Review Header */}
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 ring-2 ring-border/20">
                              <AvatarImage
                                src={review.user_profiles?.avatar_url || undefined}
                                alt={review.user_profiles?.display_name || "User"}
                              />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-primary-foreground">
                                {getUserInitials(review)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">
                                  {review.user_profiles?.display_name || review.user_profiles?.username || "User"}
                                </h3>
                                <span className="text-sm text-muted-foreground">reviewed</span>
                                <Badge variant="secondary" className="text-xs">
                                  {review.tool_id}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{formatDate(review.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${i < review.rating
                                    ? "fill-primary text-primary"
                                    : "fill-muted text-muted"
                                  }`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Review Content */}
                        <div className="mb-4">
                          {review.title && <h4 className="mb-2 text-lg font-semibold">{review.title}</h4>}
                          <p className="text-muted-foreground leading-relaxed">
                            {review.review_text || "No review text provided."}
                          </p>
                        </div>

                        {/* Review Actions */}
                        <div className="flex items-center gap-4 border-t border-border/40 pt-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleMarkHelpful(review.id)}
                          >
                            <ThumbsUp className="h-4 w-4" />
                            {review.helpful_count || 0}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
