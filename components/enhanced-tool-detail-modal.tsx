"use client"

import { useState, useEffect } from "react"
import { ToolImage } from "@/components/tool-image"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { X, ExternalLink, Heart, Share2, Star, Zap, Plus, DollarSign, Sparkles, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PricingBadge } from "@/components/pricing-badge"
import { toast } from "sonner"
import type { ToolWithRating } from "@/lib/types"
import { logger } from "@/lib/logger"

interface Tool {
  id: string
  name: string
  category: string
  description: string
  image: string | null
  rating: number | null
  users: string | null
  tags?: string[]
  platform?: string
  pricing?: string
  accessType?: string
}

interface ToolDetailModalProps {
  tool: Tool | null
  isOpen: boolean
  onClose: () => void
}

interface Review {
  id: string
  user_id: string
  rating: number
  title?: string
  review_text?: string
  created_at: string
  user?: {
    display_name?: string
    username?: string
    avatar_url?: string
  }
}

interface Collection {
  id: string
  name: string
  is_public: boolean
}

export function ToolDetailModal({ tool, isOpen, onClose }: ToolDetailModalProps) {
  const router = useRouter()
  const [isFavorited, setIsFavorited] = useState(false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoadingReviews, setIsLoadingReviews] = useState(false)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [showCollectionDialog, setShowCollectionDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string>("")
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewTitle, setReviewTitle] = useState("")
  const [reviewText, setReviewText] = useState("")
  const [copied, setCopied] = useState(false)
  const [similarTools, setSimilarTools] = useState<Tool[]>([])

  useEffect(() => {
    if (isOpen && tool) {
      loadReviews()
      loadCollections()
      loadSimilarTools()
      checkIfFavorited()
    }
    // Functions are stable and don't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tool])

  const loadReviews = async () => {
    if (!tool) return
    setIsLoadingReviews(true)
    try {
      const response = await fetch(`/api/reviews?toolId=${tool.id}`)
      if (response.ok) {
        const data = await response.json()
        setReviews(data.reviews || [])
      }
    } catch (error) {
      logger.error('Error loading reviews:', error)
    } finally {
      setIsLoadingReviews(false)
    }
  }

  const loadCollections = async () => {
    try {
      const response = await fetch('/api/user/collections')
      if (response.ok) {
        const data = await response.json()
        setCollections(data.collections || [])
      }
    } catch (error) {
      logger.error('Error loading collections:', error)
    }
  }

  const loadSimilarTools = async () => {
    if (!tool) return
    try {
      const response = await fetch(`/api/ai-models?category=${encodeURIComponent(tool.category)}&limit=4`)
      if (response.ok) {
        const data = await response.json()
        // Ensure data is an array
        const toolsArray = Array.isArray(data) ? data : []
        // Filter out the current tool
        setSimilarTools(toolsArray.filter((t: Tool) => t.id !== tool.id).slice(0, 3))
      }
    } catch (error) {
      logger.error('Error loading similar tools:', error)
      setSimilarTools([]) // Set empty array on error
    }
  }

  const checkIfFavorited = async () => {
    if (!tool) return
    try {
      const response = await fetch(`/api/favorites/${tool.id}`)
      if (response.ok) {
        const data = await response.json()
        setIsFavorited(data.isFavorite)
      }
    } catch (error) {
      logger.error('Error checking favorite status:', error)
    }
  }

  const handleVisitWebsite = () => {
    const url = (tool as Tool & { platform?: string })?.platform || '#'
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      toast.error('Website URL not available')
    }
  }

  const handleToggleFavorite = async () => {
    if (!tool) return
    setIsTogglingFavorite(true)
    try {
      if (isFavorited) {
        // Remove favorite
        const response = await fetch(`/api/favorites/${tool.id}`, {
          method: 'DELETE'
        })
        if (response.ok) {
          setIsFavorited(false)
          toast.success('Removed from favorites')
        } else {
          toast.error('Failed to remove from favorites')
        }
      } else {
        // Add favorite
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_id: tool.id })
        })
        if (response.ok) {
          setIsFavorited(true)
          toast.success('Added to favorites')
        } else {
          toast.error('Failed to add to favorites')
        }
      }
    } catch (error) {
      logger.error('Error toggling favorite:', error)
      toast.error('Failed to update favorites')
    } finally {
      setIsTogglingFavorite(false)
    }
  }

  const handleAddToCollection = async () => {
    if (!selectedCollection || !tool) return
    try {
      const response = await fetch(`/api/collections/${selectedCollection}/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: tool.id })
      })

      if (response.ok) {
        toast.success('Added to collection')
        setShowCollectionDialog(false)
        setSelectedCollection("")
      } else {
        const errorData = await response.json().catch(() => ({}))
        const message = response.status === 409 
          ? 'Tool is already in this collection'
          : response.status === 404
          ? 'Collection not found'
          : response.status === 403
          ? 'You do not have permission to edit this collection'
          : errorData.message || 'Failed to add to collection'
        toast.error(message)
      }
    } catch (error) {
      logger.error('Error adding to collection:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add to collection')
    }
  }

  const handleSubmitReview = async () => {
    if (!tool) return
    
    // Validate rating
    if (reviewRating < 1 || reviewRating > 5) {
      toast.error('Please select a rating between 1 and 5 stars')
      return
    }
    
    try {
      logger.debug('Submitting review:', { tool_id: tool.id, rating: reviewRating, title: reviewTitle })
      
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: tool.id,
          rating: reviewRating,
          title: reviewTitle,
          review_text: reviewText
        })
      })

      if (response.ok) {
        toast.success('Review submitted successfully!')
        setShowReviewDialog(false)
        setReviewRating(5)
        setReviewTitle('')
        setReviewText('')
        loadReviews()
      } else {
        const errorData = await response.json().catch(() => ({}))
        logger.error('Review submission failed:', response.status, errorData)
        
        const message = response.status === 409
          ? 'You have already reviewed this tool'
          : response.status === 401
          ? 'Please sign in to submit a review'
          : response.status === 400
          ? 'Please provide a valid rating (1-5 stars)'
          : errorData.error || errorData.message || 'Failed to submit review'
        toast.error(message)
      }
    } catch (error) {
      logger.error('Error submitting review:', error)
      toast.error('Network error: Failed to submit review. Please check your connection.')
    }
  }

  const handleCopyLink = async () => {
    if (!tool) return
    const url = tool.platform || `${window.location.origin}/tools/${tool.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }

  const handleNativeShare = async () => {
    if (!tool) return
    const shareData = {
      title: tool.name,
      text: tool.description,
      url: tool.platform || `${window.location.origin}/tools/${tool.id}`
    }

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData)
        setShowShareDialog(false)
      } else {
        toast.error('Sharing not supported on this device')
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        logger.error('Error sharing:', error)
      }
    }
  }

  if (!tool) return null

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-card border border-border w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl pointer-events-auto">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white/70 hover:text-white hover:bg-black/70 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Header with Image */}
                <div className="relative h-64">
                  <ToolImage
                    src={tool.image}
                    alt={tool.name}
                    className="object-cover"
                    sizes="100vw"
                    unoptimized={true}
                    fallbackText={tool.name}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <Badge className="bg-primary/20 text-primary border-primary/30 mb-3">{tool.category}</Badge>
                    <h2 className="text-4xl font-bold text-white drop-shadow-lg mb-2">{tool.name}</h2>
                    {tool.rating && (
                      <div className="flex items-center gap-2 text-yellow-400">
                        <Star className="w-5 h-5 fill-current" />
                        <span className="font-semibold text-lg">{tool.rating}</span>
                        {tool.users && (
                          <span className="text-white/80 text-sm">({tool.users} users)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Description */}
                  <div>
                    <p className="text-muted-foreground text-lg leading-relaxed">{tool.description}</p>
                  </div>

                  {/* Pricing Section */}
                  {(tool.pricing || tool.accessType) && (
                    <Card className="p-4 bg-muted/50 border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-muted-foreground" />
                          <span className="font-semibold text-sm text-muted-foreground">Pricing:</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <PricingBadge 
                            pricing={tool.pricing} 
                            accessType={tool.accessType} 
                            size="lg"
                          />
                          {tool.accessType && (
                            <Badge variant="outline" className="text-xs">
                              {tool.accessType}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {tool.pricing && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {tool.pricing}
                        </p>
                      )}
                    </Card>
                  )}

                  {/* Tags */}
                  {tool.tags && tool.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-sm font-semibold text-muted-foreground mr-1">Tags:</span>
                      {tool.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="border-border">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      className="flex-1 min-w-[200px]"
                      onClick={handleVisitWebsite}
                    >
                      Visit Website <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleToggleFavorite}
                      disabled={isTogglingFavorite}
                    >
                      <Heart className={`w-4 h-4 mr-2 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                      {isFavorited ? 'Favorited' : 'Favorite'}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowCollectionDialog(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Collection
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowShareDialog(true)}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </div>

                  <Separator />

                  {/* Reviews Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold">Reviews</h3>
                      <Button onClick={() => setShowReviewDialog(true)}>
                        <Star className="w-4 h-4 mr-2" />
                        Write Review
                      </Button>
                    </div>

                    {isLoadingReviews ? (
                      <div className="flex justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : reviews.length === 0 ? (
                      <Card className="p-8 text-center bg-card/50">
                        <Star className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {reviews.slice(0, 3).map((review) => (
                          <Card key={review.id} className="p-4 bg-card/50">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold">{review.user?.display_name || review.user?.username || 'Anonymous'}</p>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                  ))}
                                </div>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {new Date(review.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {review.title && <p className="font-medium mb-1">{review.title}</p>}
                            {review.review_text && <p className="text-muted-foreground">{review.review_text}</p>}
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Similar Tools */}
                  {similarTools.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-2xl font-bold mb-4">Similar AI Tools</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {similarTools.map((similarTool) => (
                            <Card
                              key={similarTool.id} 
                              className="p-4 hover:border-primary cursor-pointer transition-colors"
                              onClick={() => {
                                onClose()
                                router.push(`/tools/${similarTool.id}`)
                              }}
                            >
                              <div className="relative w-full h-32 rounded-lg mb-3 overflow-hidden bg-muted">
                                <ToolImage
                                  src={similarTool.image}
                                  alt={similarTool.name}
                                  className="object-cover"
                                  sizes="(max-width: 768px) 100vw, 33vw"
                                  unoptimized={true}
                                  fallbackText={similarTool.name}
                                />
                              </div>
                              <h4 className="font-semibold mb-1">{similarTool.name}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-2">{similarTool.description}</p>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add to Collection Dialog */}
      <Dialog open={showCollectionDialog} onOpenChange={setShowCollectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Collection</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {collections.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You don't have any collections yet.</p>
                <Button onClick={() => router.push('/collections')}>
                  Create Collection
                </Button>
              </div>
            ) : (
              <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCollectionDialog(false)}>Cancel</Button>
            <Button onClick={handleAddToCollection} disabled={!selectedCollection}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Write Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rating</label>
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setReviewRating(i + 1)}
                    className="focus:outline-none"
                  >
                    <Star className={`w-8 h-8 ${i < reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Title (optional)</label>
              <input 
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Sum up your experience"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Review (optional)</label>
              <Textarea 
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your thoughts..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitReview}>Submit Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {tool.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={handleNativeShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share via...
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={handleCopyLink}
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-2">Link to website:</p>
              <code className="block p-2 bg-muted rounded text-xs break-all">
                {tool.platform || `${window.location.origin}/tools/${tool.id}`}
              </code>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
