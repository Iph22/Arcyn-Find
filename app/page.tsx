"use client"

import { useState, useMemo, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { HeroSection } from "@/components/hero-section"
import { EnhancedSearchBar } from "@/components/enhanced-search-bar"
import { searchAIEntries, addToSearchHistory, trackSearch, groupResultsByCategory } from "@/lib/search-utils"
import { FilterBar } from "@/components/filter-bar"
import { AICard } from "@/components/ai-card"
import { ThemeToggle } from "@/components/theme-toggle"
import { aiEntries, type AIEntry } from "@/lib/ai-data"
import { Grid3x3, List, Loader2, ArrowUp, Share2, Heart, GitCompare } from "lucide-react"
import { Footer } from "@/components/footer"
import { getTrendingAIs, trackAIView } from "@/lib/trending-utils"
import { useURLState, useKeyboardShortcuts, useScrollToTop, useFavorites, useShare } from "@/lib/hooks"

// Lazy load heavy components using Next.js dynamic import
const TrendingSection = dynamic(() => import("@/components/trending-section").then(m => ({ default: m.TrendingSection })), {
  ssr: false,
  loading: () => (
    <section className="border-b border-border/50 bg-gradient-to-b from-background to-background/50 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl border border-border/50 bg-card/50" />
          ))}
        </div>
      </div>
    </section>
  )
})

const COMPARISON_STORAGE_KEY = 'arcyn-find-comparison-tools'

export default function Home() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL state management for filters and search
  const initialQ = searchParams?.get('q') || ''
  const initialCategory = searchParams?.get('category') || ''
  const initialRegion = searchParams?.get('region') || ''
  const initialAccess = searchParams?.get('access') || ''

  const [searchQuery, setSearchQuery] = useURLState('q', initialQ)
  const [selectedCategory, setSelectedCategory] = useURLState('category', initialCategory)
  const [selectedRegion, setSelectedRegion] = useURLState('region', initialRegion)
  const [selectedAccessType, setSelectedAccessType] = useURLState('access', initialAccess)

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [aiModels, setAiModels] = useState<AIEntry[]>(aiEntries) // Start with static data as fallback
  const [loading, setLoading] = useState(false) // Start with false so content shows immediately
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [trendingAIs, setTrendingAIs] = useState<AIEntry[]>([])
  const [trendingLoading, setTrendingLoading] = useState(true)
  const [comparisonTools, setComparisonTools] = useState<AIEntry[]>([])

  // Custom hooks
  const { isVisible: showBackToTop, scrollToTop } = useScrollToTop()
  const { toggleFavorite, isFavorite, favorites } = useFavorites()
  const { share } = useShare()

  // Redirect first-time visitors to welcome page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeenWelcomePermanent = localStorage.getItem('arcyn-find-welcome-seen')
      const hasSeenWelcomeSession = sessionStorage.getItem('arcyn-find-welcome-session')

      // Don't redirect if user has permanently disabled it OR has seen it this session
      if (!hasSeenWelcomePermanent && !hasSeenWelcomeSession && window.location.pathname === '/') {
        router.push('/welcome')
      }
    }
  }, [router])

  // Fetch AI models from API
  useEffect(() => {
    async function fetchModels() {
      try {
        setLoading(true)

        // Add timeout to prevent hanging (10 seconds)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await fetch('/api/ai-models', {
          cache: 'no-store', // Always fetch fresh data on client
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0) {
            setAiModels(data)
            setLastUpdated(new Date())
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn('API request timed out, using fallback data')
        } else {
          console.error('Failed to fetch AI models, using fallback data:', error)
        }
        // Keep the fallback static data
      } finally {
        setLoading(false)
      }
    }

    fetchModels()

    // Set up polling for real-time updates (every 5 minutes)
    const interval = setInterval(fetchModels, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  // Load comparison tools from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && aiModels.length > 0) {
      const stored = localStorage.getItem(COMPARISON_STORAGE_KEY)
      if (stored) {
        try {
          const toolIds = JSON.parse(stored) as string[]
          const loadedTools = toolIds
            .map(id => aiModels.find(ai => ai.id === id))
            .filter((ai): ai is AIEntry => ai !== undefined)
          setComparisonTools(loadedTools)
        } catch (error) {
          console.error('Failed to load comparison tools:', error)
        }
      }
    }
  }, [aiModels])

  // Enhanced search and filter with relevance sorting
  const { results: filteredAIs } = useMemo(() => {
    const searchResult = searchAIEntries(aiModels, searchQuery, {
      category: selectedCategory,
      region: selectedRegion,
      accessType: selectedAccessType,
    })

    // Track search analytics
    if (searchQuery.trim()) {
      trackSearch(searchQuery, searchResult.results.length)
    }

    return searchResult
  }, [aiModels, searchQuery, selectedCategory, selectedRegion, selectedAccessType])

  // Group results by category (optional - can be used for display)
  const groupedResults = useMemo(() => {
    return groupResultsByCategory(filteredAIs)
  }, [filteredAIs])

  // Fetch real-time trending AIs (combines local views + online trending)
  useEffect(() => {
    async function fetchTrending() {
      if (aiModels.length === 0) return

      setTrendingLoading(true)
      try {
        const trending = await getTrendingAIs(aiModels, 3)
        setTrendingAIs(trending)
      } catch (error) {
        console.error('Failed to fetch trending AIs:', error)
        // Fallback to static trending if online fetch fails
        const fallbackTrending = aiModels
          .filter((ai) => ai.isTrending)
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 3)
        setTrendingAIs(fallbackTrending)
      } finally {
        setTrendingLoading(false)
      }
    }

    fetchTrending()

    // Refresh trending every 5 minutes
    const interval = setInterval(fetchTrending, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [aiModels])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    '/': () => {
      const input = document.querySelector('input[type="text"]') as HTMLInputElement
      input?.focus()
    },
    'escape': () => {
      const input = document.querySelector('input[type="text"]') as HTMLInputElement
      if (document.activeElement === input) {
        input?.blur()
      }
    },
  })

  const handleSelectAI = useCallback((ai: AIEntry) => {
    // Track the view when user clicks on an AI tool
    trackAIView(ai.id)
    router.push(`/ai/${ai.id}`)
  }, [router])

  const handleSearch = useCallback((query: string) => {
    if (query.trim()) {
      addToSearchHistory(query)
    }
  }, [])

  const handleShare = useCallback(async () => {
    const url = window.location.href
    const title = 'Arcyn Find - Discover AI Tools'
    const text = `Check out ${filteredAIs.length} AI tools on Arcyn Find!`

    const shared = await share({ title, text, url })
    if (shared) {
      // Could show a toast notification here
    }
  }, [share, filteredAIs.length])

  const handleAddToComparison = useCallback((ai: AIEntry) => {
    setComparisonTools((prev) => {
      let updated: AIEntry[]
      if (prev.find((t) => t.id === ai.id)) {
        updated = prev.filter((t) => t.id !== ai.id)
      } else if (prev.length >= 3) {
        updated = [...prev.slice(1), ai]
      } else {
        updated = [...prev, ai]
      }

      // Save to localStorage
      if (typeof window !== 'undefined') {
        if (updated.length === 0) {
          localStorage.removeItem(COMPARISON_STORAGE_KEY)
        } else {
          localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(updated.map(t => t.id)))
        }
      }

      return updated
    })
  }, [])

  const handleOpenComparison = useCallback(() => {
    if (comparisonTools.length > 0) {
      router.push('/compare')
    }
  }, [comparisonTools.length, router])

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-accent-foreground focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to main content
      </a>

      <HeroSection />

      {/* Search Section */}
      <section className="border-b border-border/50 bg-background/50 py-4 sm:py-6 md:py-8">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <EnhancedSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              aiModels={aiModels}
              onSearch={handleSearch}
              showResultCount={true}
              onResultCountChange={(count) => {
                if (searchQuery.trim()) {
                  trackSearch(searchQuery, count)
                }
              }}
            />
          </div>
          <div className="flex justify-end sm:flex-none">
            <ThemeToggle />
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <FilterBar
        onCategoryChange={setSelectedCategory}
        onRegionChange={setSelectedRegion}
        onAccessTypeChange={setSelectedAccessType}
        selectedCategory={selectedCategory}
        selectedRegion={selectedRegion}
        selectedAccessType={selectedAccessType}
      />

      {/* Trending Section */}
      <Suspense fallback={
        <section className="border-b border-border/50 bg-gradient-to-b from-background to-background/50 py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl border border-border/50 bg-card/50" />
              ))}
            </div>
          </div>
        </section>
      }>
        <TrendingSection trendingAIs={trendingAIs} onSelectAI={handleSelectAI} />
      </Suspense>

      {/* Main Content */}
      <section id="main-content" className="py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          {/* Header with View Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">All AI Tools</h2>
              <p className="mt-2 text-muted-foreground">
                {filteredAIs.length} {filteredAIs.length === 1 ? "result" : "results"}
                {lastUpdated && (
                  <span className="ml-2 text-xs">
                    • Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-2">
              {comparisonTools.length > 0 && (
                <button
                  onClick={handleOpenComparison}
                  className="rounded-lg p-2.5 sm:p-2 transition-all touch-manipulation hover:bg-muted text-muted-foreground hover:text-foreground relative"
                  aria-label={`Compare ${comparisonTools.length} tools`}
                  title={`Compare ${comparisonTools.length} tool${comparisonTools.length > 1 ? 's' : ''}`}
                >
                  <GitCompare className="h-5 w-5" />
                  {comparisonTools.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                      {comparisonTools.length}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={handleShare}
                className="rounded-lg p-2.5 sm:p-2 transition-all touch-manipulation hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Share this page"
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2.5 sm:p-2 transition-all touch-manipulation ${viewMode === "grid" ? "bg-accent/20 text-accent" : "hover:bg-muted text-muted-foreground"
                  }`}
                aria-label="Grid view"
              >
                <Grid3x3 className="h-5 w-5 sm:h-5 sm:w-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-2.5 sm:p-2 transition-all touch-manipulation ${viewMode === "list" ? "bg-accent/20 text-accent" : "hover:bg-muted text-muted-foreground"
                  }`}
                aria-label="List view"
              >
                <List className="h-5 w-5 sm:h-5 sm:w-5" />
              </button>
            </div>
          </motion.div>

          {/* AI Grid/List */}
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl border border-border/50 bg-card/50" />
              ))}
            </div>
          ) : filteredAIs.length > 0 ? (
            <>
              <motion.div
                layout
                className={`grid gap-6 ${viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 max-w-4xl"
                  }`}
              >
                {filteredAIs.slice(0, 25).map((ai, idx) => (
                  <div key={ai.id} className="relative">
                    <AICard
                      ai={ai}
                      onClick={() => handleSelectAI(ai)}
                      delay={idx * 0.05}
                      searchQuery={searchQuery}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddToComparison(ai)
                      }}
                      className="absolute top-2 right-2 z-10 rounded-lg bg-background/80 p-1.5 backdrop-blur-sm hover:bg-background transition-colors"
                      aria-label={comparisonTools.find((t) => t.id === ai.id) ? "Remove from comparison" : "Add to comparison"}
                      title={comparisonTools.find((t) => t.id === ai.id) ? "Remove from comparison" : "Add to comparison"}
                    >
                      <GitCompare className={`h-4 w-4 ${comparisonTools.find((t) => t.id === ai.id) ? 'text-accent' : 'text-muted-foreground'}`} />
                    </button>
                  </div>
                ))}
              </motion.div>
              {filteredAIs.length > 25 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8 flex justify-center"
                >
                  <button
                    onClick={() => router.push('/ai-tools')}
                    className="rounded-lg bg-accent px-8 py-3 font-medium text-accent-foreground transition-all hover:shadow-lg hover:shadow-accent/50 active:scale-95"
                  >
                    See More ({filteredAIs.length - 25} more)
                  </button>
                </motion.div>
              )}
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card/30 py-12"
            >
              <p className="text-lg font-semibold text-foreground mb-2">No AI tools found</p>
              <p className="text-muted-foreground">Try adjusting your filters or search query</p>
            </motion.div>
          )}
        </div>
      </section>


      {/* Footer */}
      <Footer />

      {/* Back to Top Button */}
      {showBackToTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 rounded-full bg-accent p-3 text-accent-foreground shadow-lg transition-all hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}

    </main>
  )
}
