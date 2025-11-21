"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ExternalLink, Star, Bookmark, Share2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ToolDetailModal } from "@/components/tool-detail-modal"
import { ReviewCard } from "@/components/review-card"
import { useAITool } from "@/lib/hooks/use-ai-tools"
import { useFavorites } from "@/lib/hooks/use-favorites"
import { useReviews } from "@/lib/hooks/use-reviews"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { EmptyState } from "@/components/empty-state"
import { ToolCardSkeleton } from "@/components/loading-skeleton"
import type { AIEntry } from "@/lib/ai-data"

export default function ToolDetailPage() {
  const params = useParams()
  const router = useRouter()
  const toolId = Array.isArray(params.id) ? params.id[0] : params.id || null

  const { tool, isLoading, error } = useAITool(toolId)
  const { isFavorite, toggleFavorite } = useFavorites()
  const { reviews, isLoading: reviewsLoading, fetchReviews } = useReviews(toolId || "")
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (toolId) {
      fetchReviews()
    }
  }, [toolId, fetchReviews])

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto p-8">
          <ToolCardSkeleton />
        </div>
      </div>
    )
  }

  if (error || !tool) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto p-8">
          <EmptyState
            icon={ArrowLeft}
            title="Tool not found"
            description="The tool you're looking for doesn't exist or has been removed."
            action={{
              label: "Go Back",
              onClick: () => router.push("/tools"),
            }}
          />
        </div>
      </div>
    )
  }

  const toolForModal: any = {
    id: tool.id,
    name: tool.name,
    category: tool.category,
    description: tool.description,
    image: (tool as any).image || null,
    rating: (tool as any).rating || null,
    users: (tool as any).users || null,
    tags: tool.tags,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-4xl p-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="mb-6 overflow-hidden">
              {(tool as any).image && (
                <div className="relative h-64 w-full overflow-hidden bg-muted">
                  <img
                    src={(tool as any).image}
                    alt={tool.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h1 className="mb-2 text-3xl font-bold">{tool.name}</h1>
                    <div className="flex flex-wrap gap-2">
                      {tool.category && (
                        <Badge variant="outline">{tool.category}</Badge>
                      )}
                      {tool.accessType && (
                        <Badge variant="outline">{tool.accessType}</Badge>
                      )}
                      {(tool as any).rating && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {(tool as any).rating.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleFavorite(tool.id)}
                    >
                      <Bookmark
                        className={`h-4 w-4 ${
                          isFavorite(tool.id) ? "fill-primary text-primary" : ""
                        }`}
                      />
                    </Button>
                    {(tool as any).url && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open((tool as any).url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="icon">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
                  {tool.description}
                </p>

                {tool.tags && tool.tags.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-2 font-semibold">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {tool.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(tool as any).url && (
                  <Button
                    className="w-full"
                    onClick={() => window.open((tool as any).url, "_blank")}
                  >
                    Visit Website
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>

            <Separator className="my-6" />

            <div>
              <h2 className="mb-4 text-2xl font-bold">Reviews</h2>
              {reviewsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <ToolCardSkeleton key={i} />
                  ))}
                </div>
              ) : reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Star}
                  title="No reviews yet"
                  description="Be the first to review this tool!"
                />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

