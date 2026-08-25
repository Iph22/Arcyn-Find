"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { ExternalLink, Star, Bookmark, BookmarkCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ToolImage } from "./tool-image"
import type { ToolWithRating } from "@/lib/types"

interface ToolCardProps {
  tool: ToolWithRating
  onSelect?: (tool: ToolWithRating) => void
  onBookmark?: (tool: ToolWithRating) => void
  isBookmarked?: boolean
  className?: string
}

function ToolCardComponent({
  tool,
  onSelect,
  onBookmark,
  isBookmarked = false,
  className,
}: ToolCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn("h-full", className)}
    >
      <Card className="group relative h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-lg">
        {/* Tool Image */}
        <div className="relative h-48 overflow-hidden bg-muted">
          <ToolImage
            src={tool.image}
            alt={tool.name}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized={true}
            fallbackText={tool.name}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <div className="absolute top-3 right-3 flex gap-2">
            {tool.rating && (
              <Badge variant="secondary" className="gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {tool.rating.toFixed(1)}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
              onClick={(e) => {
                e.stopPropagation()
                onBookmark?.(tool)
              }}
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-primary" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Tool Info */}
        <div className="p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 font-semibold text-lg">{tool.name}</h3>
            {tool.url && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(tool.url!, "_blank", "noopener,noreferrer")
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>

          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {tool.description}
          </p>

          <div className="mb-3 flex flex-wrap gap-1">
            {tool.category && (
              <Badge variant="outline" className="text-xs">
                {tool.category}
              </Badge>
            )}
            {tool.accessType && (
              <Badge variant="outline" className="text-xs">
                {tool.accessType}
              </Badge>
            )}
          </div>

          {tool.tags && tool.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tool.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {tool.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{tool.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          <Button
            className="mt-4 w-full"
            onClick={() => onSelect?.(tool)}
          >
            View Details
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

export const ToolCard = memo(ToolCardComponent)

