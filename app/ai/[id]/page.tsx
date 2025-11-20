"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ExternalLink, Copy, Check, Share2, Heart } from "lucide-react"
import type { AIEntry } from "@/lib/ai-data"
import { trackAIView } from "@/lib/trending-utils"
import { useFavorites, useShare } from "@/lib/hooks"
import { StructuredData } from "./structured-data"

export default function AIDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [ai, setAi] = useState<AIEntry | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCopiedToast, setShowCopiedToast] = useState(false)
  const { toggleFavorite, isFavorite } = useFavorites()
  const { share } = useShare()
  
  const favorited = ai ? isFavorite(ai.id) : false

  useEffect(() => {
    async function fetchAI() {
      try {
        setLoading(true)
        const id = params.id as string

        if (!id) {
          router.push('/')
          return
        }

        // Fetch the specific tool by ID using the API's id parameter
        const response = await fetch(`/api/ai-models?id=${encodeURIComponent(id)}`)
        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0 && data[0]) {
            setAi(data[0])
            setLoading(false)
            return
          }
        }

        // Fallback: If ID parameter doesn't work, try searching with high limit
        if (response.status === 404) {
          const searchResponse = await fetch(`/api/ai-models?search=${encodeURIComponent(id)}&limit=1000`)
          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            const foundById = searchData.find((entry: AIEntry) => entry.id === id)
            if (foundById) {
              setAi(foundById)
              setLoading(false)
              return
            }
          }
        }

        // If still not found, redirect to home
        console.warn(`AI tool with ID "${id}" not found`)
        router.push('/')
      } catch (error) {
        console.error('Failed to fetch AI details:', error)
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchAI()
    }
  }, [params.id, router])

  // Track view when AI tool is loaded
  useEffect(() => {
    if (ai) {
      trackAIView(ai.id)
    }
  }, [ai])

  const handleCopy = useCallback(() => {
    if (ai) {
      navigator.clipboard.writeText(ai.platform)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [ai])

  const handleShare = useCallback(async () => {
    if (!ai || typeof window === 'undefined') return
    
    const url = window.location.href
    const title = `${ai.name} - AI Tool`
    const text = `Check out ${ai.name}: ${ai.description} ${url}`

    // Use Web Share API if available (iOS Safari, Android Chrome)
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        })
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== 'AbortError') {
          // Fallback to clipboard
          try {
            await navigator.clipboard.writeText(url)
            setShowCopiedToast(true)
            setTimeout(() => setShowCopiedToast(false), 2000)
          } catch (clipboardError) {
            console.error('Failed to copy to clipboard:', clipboardError)
          }
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url)
        setShowCopiedToast(true)
        setTimeout(() => setShowCopiedToast(false), 2000)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
      }
    }
  }, [ai])

  const handleFavorite = useCallback(() => {
    if (ai) {
      toggleFavorite(ai.id)
    }
  }, [ai, toggleFavorite])

  const getAccessTypeColor = (type: string) => {
    switch (type) {
      case "Free":
        return "bg-green-500/20 text-green-400"
      case "Freemium":
        return "bg-blue-500/20 text-blue-400"
      case "Paid":
        return "bg-purple-500/20 text-purple-400"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading AI tool details...</p>
        </div>
      </div>
    )
  }

  if (!ai) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">AI Tool Not Found</h1>
          <p className="text-muted-foreground mb-4">The AI tool you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/')}
            className="rounded-lg bg-accent px-4 py-2 text-accent-foreground hover:bg-accent/90 transition-colors"
          >
            Go Back Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {ai && <StructuredData ai={ai} />}
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </motion.button>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-border/50 bg-card shadow-xl p-8"
        >
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div className="flex-1">
              <h1 className="mb-2 text-4xl font-bold text-foreground">{ai.name}</h1>
              <p className="text-xl text-accent">{ai.category}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleFavorite}
                className="rounded-lg p-2 border border-border hover:bg-muted transition-colors"
                aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                title={favorited ? "Remove from favorites" : "Add to favorites"}
              >
                <Heart
                  className={`h-5 w-5 transition-colors ${
                    favorited ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-500"
                  }`}
                />
              </button>
              <button
                onClick={handleShare}
                className="rounded-lg p-2 border border-border hover:bg-muted transition-colors"
                aria-label="Share this AI tool"
                title="Share"
              >
                <Share2 className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="mb-8 text-base text-muted-foreground leading-relaxed">{ai.description}</p>

          {/* Information Grid */}
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Access Type</p>
              <p className={`text-lg font-bold rounded-lg w-fit px-3 py-1 ${getAccessTypeColor(ai.accessType)}`}>
                {ai.accessType}
              </p>
            </div>

            <div className="rounded-lg bg-muted/30 p-4">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Pricing</p>
              <p className="text-lg font-bold text-foreground">{ai.pricing}</p>
            </div>

            <div className="rounded-lg bg-muted/30 p-4">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Region</p>
              <p className="text-lg font-bold text-foreground">{ai.region}</p>
            </div>

            <div className="rounded-lg bg-muted/30 p-4">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Popularity</p>
              <p className="text-lg font-bold text-accent">{ai.popularity}%</p>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-8">
            <p className="mb-3 text-sm font-semibold text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-2">
              {ai.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Platform Link */}
          <div className="mb-8 rounded-lg border border-border/50 bg-muted/30 p-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Platform Link</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ai.platform}
                readOnly
                className="flex-1 rounded-lg bg-background px-3 py-2 text-sm text-foreground"
                aria-label="Platform URL"
              />
              <button
                onClick={handleCopy}
                className="rounded-lg bg-accent/20 p-2 hover:bg-accent/40 transition-colors"
                aria-label={copied ? "Link copied to clipboard" : "Copy platform link"}
              >
                {copied ? <Check className="h-4 w-4 text-green-400" aria-hidden="true" /> : <Copy className="h-4 w-4 text-accent" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Last Updated */}
          <p className="mb-6 text-xs text-muted-foreground">
            Last updated: {new Date(ai.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <a
              href={ai.platform}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-accent px-4 py-3 font-medium text-accent-foreground transition-all hover:shadow-lg hover:shadow-accent/50 active:scale-95 flex items-center justify-center gap-2"
              aria-label={`Visit ${ai.name} platform`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Visit Platform
            </a>
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-border bg-card px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted"
              aria-label="Go back"
            >
              Go Back
            </button>
          </div>
        </motion.div>
      </div>

      {/* Copy to Clipboard Toast */}
      <AnimatePresence>
        {showCopiedToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-accent text-accent-foreground px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm sm:text-base font-medium"
            role="alert"
            aria-live="polite"
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Link copied to clipboard!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

