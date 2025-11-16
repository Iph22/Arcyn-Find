"use client"

import { motion } from "framer-motion"
import { Star, ExternalLink, Zap, Heart } from "lucide-react"
import type { AIEntry } from "@/lib/ai-data"
import { useState, useCallback, memo } from "react"
import { HighlightText } from "./highlight-text"
import { trackAIView } from "@/lib/trending-utils"
import { useFavorites } from "@/lib/hooks"

interface AICardProps {
  ai: AIEntry
  onClick: () => void
  delay?: number
  searchQuery?: string
  showFavorite?: boolean
}

export const AICard = memo(function AICard({ ai, onClick, delay = 0, searchQuery = "", showFavorite = true }: AICardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { toggleFavorite, isFavorite } = useFavorites()
  const favorited = isFavorite(ai.id)

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(ai.id)
  }, [ai.id, toggleFavorite])

  const getAccessTypeColor = (type: string) => {
    switch (type) {
      case "Free":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "Freemium":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "Paid":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => {
        trackAIView(ai.id)
        onClick()
      }}
      className="group cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          trackAIView(ai.id)
          onClick()
        }
      }}
      aria-label={`View details for ${ai.name}`}
    >
      <div className="card-hover relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden="true"
        />

        <div className="relative z-10 p-4 sm:p-6">
          <div className="mb-3 sm:mb-4 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                  <HighlightText text={ai.name} query={searchQuery} />
                </h3>
                {ai.isTrending && (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                    className="flex items-center gap-1 rounded-full bg-accent/20 px-2 py-1 text-xs font-medium text-accent"
                    aria-label="This tool is trending"
                  >
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    Trending
                  </motion.div>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{ai.category}</p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {showFavorite && (
                <button
                  onClick={handleFavoriteClick}
                  className="rounded p-1 sm:p-1.5 transition-colors hover:bg-muted touch-manipulation"
                  aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                  title={favorited ? "Remove from favorites" : "Add to favorites"}
                >
                  <Heart
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors ${
                      favorited ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-500"
                    }`}
                  />
                </button>
              )}
              <motion.div animate={{ rotate: isHovered ? 15 : 0 }} transition={{ type: "spring", stiffness: 200 }}>
                <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5 text-accent/60 group-hover:text-accent" aria-hidden="true" />
              </motion.div>
            </div>
          </div>

          <p className="mb-3 sm:mb-4 line-clamp-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <HighlightText text={ai.description} query={searchQuery} />
          </p>

          <div className="mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-0.5 sm:gap-1" aria-label={`Popularity: ${ai.popularity}%`}>
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
                    i < Math.round(ai.popularity / 20) ? "fill-accent text-accent" : "text-muted-foreground"
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground">{ai.popularity}%</span>
          </div>

          <div className="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2">
            {ai.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-accent/10 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-accent">
                <HighlightText text={tag} query={searchQuery} />
              </span>
            ))}
            {ai.tags.length > 2 && (
              <span className="rounded-full bg-muted px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-muted-foreground">
                +{ai.tags.length - 2} more
              </span>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-3 sm:pt-4 gap-2">
            <span
              className={`rounded-full border px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold ${getAccessTypeColor(ai.accessType)}`}
              aria-label={`Access type: ${ai.accessType}`}
            >
              {ai.accessType}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground truncate" aria-label={`Region: ${ai.region}`}>{ai.region}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.ai.id === nextProps.ai.id &&
    prevProps.ai.name === nextProps.ai.name &&
    prevProps.ai.description === nextProps.ai.description &&
    prevProps.ai.popularity === nextProps.ai.popularity &&
    prevProps.ai.isTrending === nextProps.ai.isTrending &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.showFavorite === nextProps.showFavorite &&
    prevProps.delay === nextProps.delay
  )
})
