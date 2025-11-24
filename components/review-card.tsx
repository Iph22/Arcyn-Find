"use client"

import { memo } from "react"
import { formatDistanceToNow } from "date-fns"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

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

interface ReviewCardProps {
  review: Review
  onHelpful?: (reviewId: string) => void
  onNotHelpful?: (reviewId: string) => void
  className?: string
}

function ReviewCardComponent({
  review,
  onHelpful,
  onNotHelpful,
  className,
}: ReviewCardProps) {
  const userDisplayName =
    review.user?.display_name || review.user?.username || "Anonymous"

  return (
    <Card className={cn("p-4", className)}>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={review.user?.avatar_url} />
            <AvatarFallback>
              {userDisplayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{userDisplayName}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(review.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <span
              key={i}
              className={cn(
                "text-lg",
                i < review.rating ? "text-yellow-400" : "text-muted-foreground"
              )}
            >
              ★
            </span>
          ))}
        </div>
      </div>

      <p className="mb-3 text-sm leading-relaxed">{review.comment}</p>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2"
          onClick={() => onHelpful?.(review.id)}
        >
          <ThumbsUp className="h-4 w-4" />
          Helpful ({review.helpful_count || 0})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => onNotHelpful?.(review.id)}
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}

export const ReviewCard = memo(ReviewCardComponent)

