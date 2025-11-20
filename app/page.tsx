"use client"

import { useState, useMemo, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { HeroSection } from "@/components/hero-section"
import { EnhancedSearchBar } from "@/components/enhanced-search-bar"
import { searchAIEntries, addToSearchHistory, trackSearch, groupResultsByCategory } from "@/lib/search-utils"
import { FilterBar } from "@/components/filter-bar"
import { AICard } from "@/components/ai-card"
import { ThemeToggle } from "@/components/theme-toggle"
import type { AIEntry } from "@/lib/ai-data"
import { Grid3x3, List, Loader2, ArrowUp, Share2, Heart, GitCompare, Download } from "lucide-react"
import { Footer } from "@/components/footer"
import { getTrendingAIs, trackAIView } from "@/lib/trending-utils"
import { useURLState, useKeyboardShortcuts, useScrollToTop, useFavorites, useShare } from "@/lib/hooks"
import { exportFavoritesToCSV, exportFavoritesToJSON, downloadFile } from "@/lib/export-utils"

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
  const [sortBy, setSortBy] = useState<string>("relevance")
  const [minPopularity, setMinPopularity] = useState<number>(0)

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  // Start with empty array - data will be loaded from API (not bundled in client)
  const [aiModels, setAiModels] = useState<AIEntry[]>([]) // Start empty, load from API
  const [loading, setLoading] = useState(false) // Start with false so content shows immediately
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [trendingAIs, setTrendingAIs] = useState<AIEntry[]>([])
  const [trendingLoading, setTrendingLoading] = useState(true)
  const [comparisonTools, setComparisonTools] = useState<AIEntry[]>([])
  const [showCopiedToast, setShowCopiedToast] = useState(false)
  const [shouldRedirect, setShouldRedirect] = useState<boolean | null>(null) // Track redirect status

  // Custom hooks
  const { isVisible: showBackToTop, scrollToTop } = useScrollToTop()
  const { toggleFavorite, isFavorite, favorites } = useFavorites()
  const { share } = useShare()

  // Redirect first-time visitors to welcome page - CHECK FIRST before any API calls
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Don't redirect if already on welcome page
      if (window.location.pathname === '/welcome') {
        setShouldRedirect(false)
        return
      }
      
      const hasSeenWelcomePermanent = localStorage.getItem('arcyn-find-welcome-seen')
      const hasSeenWelcomeSession = sessionStorage.getItem('arcyn-find-welcome-session')

      // Don't redirect if user has permanently disabled it OR has seen it this session
      if (!hasSeenWelcomePermanent && !hasSeenWelcomeSession && window.location.pathname === '/') {
        setShouldRedirect(true)
        router.push('/welcome')
      } else {
        setShouldRedirect(false)
      }
    }
  }, [router])

  // Fetch AI models from API - ONLY if not redirecting
  useEffect(() => {
    // Don't fetch if we're redirecting or still checking
    if (shouldRedirect === true || shouldRedirect === null) {
      return
    }

    async function fetchModels() {
      try {
        setLoading(true)

        // Add timeout to prevent hanging (10 seconds)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        // Build API URL with filters and search
        // If user is searching, use server-side search and fetch more results
        // If a category is selected, fetch more tools for that category
        // Otherwise, fetch 500 tools for general browsing
        const params = new URLSearchParams()
        
        // Priority 1: If user is searching, use server-side search
        if (searchQuery && searchQuery.trim()) {
          params.set('search', searchQuery.trim())
          params.set('limit', '2000') // Increased limit for comprehensive search results
        } else if (selectedCategory && selectedCategory.trim()) {
          // When filtering by category, fetch more tools to ensure we get all in that category
          params.set('limit', '1000')
          params.set('category', selectedCategory)
        } else {
          // For general browsing, 500 is enough
          params.set('limit', '500')
        }
        
        // Add category filter if selected (can be combined with search)
        if (selectedCategory && selectedCategory.trim()) {
          params.set('category', selectedCategory)
        }
        
        // Add region and access type filters if selected (can be combined with search)
        if (selectedRegion && selectedRegion.trim()) {
          params.set('region', selectedRegion)
        }
        if (selectedAccessType && selectedAccessType.trim()) {
          params.set('accessType', selectedAccessType)
        }

        const response = await fetch(`/api/ai-models?${params.toString()}`, {
          cache: 'no-store', // Always fetch fresh data on client
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0) {
            setAiModels(data)
            setLastUpdated(new Date())
          } else if (selectedCategory) {
            // If category filter is applied but no results, still set empty array
            setAiModels([])
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn('API request timed out')
        } else {
          console.error('Failed to fetch AI models:', error)
        }
      } finally {
        setLoading(false)
      }
    }

    // Fetch immediately on mount (only if not redirecting)
    fetchModels()

    // Set up polling for real-time updates (every 2 minutes for trending/popularity)
    const interval = setInterval(fetchModels, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [shouldRedirect, selectedCategory, selectedRegion, selectedAccessType, searchQuery]) // Re-fetch when filters or search change

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
  // If search query is present, API already filtered server-side, so just return the results
  // Otherwise, apply client-side filtering and search
  const { results: filteredAIs } = useMemo(() => {
    // If we're using server-side search, the API already filtered and sorted by relevance
    // Just return the results (no additional client-side filtering needed)
    if (searchQuery && searchQuery.trim()) {
      // Server-side search already applied with relevance sorting, just return the results
      // Track search analytics
      trackSearch(searchQuery, aiModels.length)
      return { results: aiModels, scores: new Map() }
    }
    
    // Otherwise, do client-side filtering and search
    const hasFilters = selectedCategory || selectedRegion || selectedAccessType
    const searchResult = searchAIEntries(aiModels, searchQuery, {
      // Only apply filters client-side if they weren't applied server-side
      category: hasFilters ? undefined : (selectedCategory || undefined),
      region: hasFilters ? undefined : (selectedRegion || undefined),
      accessType: hasFilters ? undefined : (selectedAccessType || undefined),
    }, { maxResults: 500 }) // Reduced from 10000 to 500 for better performance

    // Apply popularity filter
    if (minPopularity > 0) {
      searchResult.results = searchResult.results.filter(ai => ai.popularity >= minPopularity)
    }

    // Apply sorting
    const sorted = [...searchResult.results]
    switch (sortBy) {
      case "popularity":
        sorted.sort((a, b) => b.popularity - a.popularity)
        break
      case "newest":
        sorted.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
        break
      case "oldest":
        sorted.sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime())
        break
      case "relevance":
      default:
        // Keep relevance-based sorting from searchAIEntries
        break
    }

    // Track search analytics
    if (searchQuery.trim()) {
      trackSearch(searchQuery, sorted.length)
    }

    return { results: sorted, scores: searchResult.scores }
  }, [aiModels, searchQuery, selectedCategory, selectedRegion, selectedAccessType, sortBy, minPopularity])

  // Group results by category (optional - can be used for display)
  const groupedResults = useMemo(() => {
    return groupResultsByCategory(filteredAIs)
  }, [filteredAIs])

  // Fetch real-time trending AIs (combines local views + online trending)
  // When user searches, show trending from search results
  useEffect(() => {
    // Don't fetch if we're redirecting or still checking
    if (shouldRedirect === true || shouldRedirect === null) {
      return
    }

    async function fetchTrending() {
      if (aiModels.length === 0) return

      setTrendingLoading(true)
      try {
        // If user is searching, get trending from filtered results
        if (searchQuery.trim() || selectedCategory || selectedRegion || selectedAccessType) {
          const { results: searchResults } = searchAIEntries(aiModels, searchQuery, {
            category: selectedCategory,
            region: selectedRegion,
            accessType: selectedAccessType,
          }, { maxResults: 100 })
          
          // Get trending from search results
          const trending = await getTrendingAIs(searchResults, 3)
          setTrendingAIs(trending)
        } else {
          // Normal trending when no search/filters
          const trending = await getTrendingAIs(aiModels, 3)
          setTrendingAIs(trending)
        }
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

    if (aiModels.length > 0) {
      fetchTrending()
      
      // Set up polling for real-time trending updates (every 2 minutes)
      const trendingInterval = setInterval(fetchTrending, 2 * 60 * 1000)
      return () => clearInterval(trendingInterval)
    }

    // Refresh trending every 2 minutes for real-time updates
    const interval = setInterval(fetchTrending, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [aiModels, searchQuery, selectedCategory, selectedRegion, selectedAccessType, shouldRedirect])

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
    if (typeof window === 'undefined') return

    const url = window.location.href
    const title = 'Arcyn Find - Discover AI Tools'
    const text = `Check out ${filteredAIs.length} AI tools on Arcyn Find! ${url}`

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
  }, [filteredAIs.length])

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
      <section className="border-b border-border/50 bg-background/50 py-3 sm:py-6 md:py-8">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-4">
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
        onSortChange={setSortBy}
        onPopularityFilterChange={setMinPopularity}
        selectedCategory={selectedCategory}
        selectedRegion={selectedRegion}
        selectedAccessType={selectedAccessType}
        selectedSort={sortBy}
        minPopularity={minPopularity}
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
        <TrendingSection 
          trendingAIs={trendingAIs} 
          onSelectAI={handleSelectAI} 
          loading={trendingLoading}
          isSearchBased={!!(searchQuery.trim() || selectedCategory || selectedRegion || selectedAccessType)}
        />
      </Suspense>

      {/* Main Content */}
      <section id="main-content" className="py-8 sm:py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          {/* Header with View Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
          >
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground md:text-3xl">All AI Tools</h2>
              <p className="mt-1.5 sm:mt-2 text-sm sm:text-base text-muted-foreground">
                {filteredAIs.length} {filteredAIs.length === 1 ? "result" : "results"}
                {lastUpdated && (
                  <span className="ml-2 text-xs">
                    • Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={handleOpenComparison}
                disabled={comparisonTools.length === 0}
                className={`rounded-lg p-2 sm:p-2.5 transition-all touch-manipulation relative ${comparisonTools.length > 0
                  ? 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'
                  : 'text-muted-foreground/30 cursor-not-allowed opacity-50'
                  }`}
                aria-label={comparisonTools.length > 0 ? `Compare ${comparisonTools.length} tools` : "No tools in comparison"}
                title={comparisonTools.length > 0 ? `Compare ${comparisonTools.length} tool${comparisonTools.length > 1 ? 's' : ''}` : "Add tools to comparison first"}
              >
                <GitCompare className="h-4 w-4 sm:h-5 sm:w-5" />
                {comparisonTools.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-accent text-[10px] sm:text-xs font-bold text-accent-foreground animate-pulse">
                    {comparisonTools.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleShare}
                className="rounded-lg p-2 sm:p-2.5 transition-all touch-manipulation hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Share this page"
                title="Share"
              >
                <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              {favorites.size > 0 && (
                <div className="relative group">
                  <button
                    onClick={() => {
                      const favoriteTools = aiModels.filter(ai => favorites.has(ai.id))
                      const csv = exportFavoritesToCSV(favoriteTools)
                      downloadFile(csv, `my-favorites-${Date.now()}.csv`, 'text/csv')
                    }}
                    className="rounded-lg p-2 sm:p-2.5 transition-all touch-manipulation hover:bg-muted text-muted-foreground hover:text-foreground relative"
                    aria-label={`Export ${favorites.size} favorites`}
                    title={`Export ${favorites.size} favorites (CSV)`}
                  >
                    <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-accent text-[10px] sm:text-xs font-bold text-accent-foreground">
                      {favorites.size}
                    </span>
                  </button>
                  {/* Dropdown for export options */}
                  <div className="absolute right-0 top-full mt-2 hidden group-hover:block z-50">
                    <div className="rounded-lg border border-border bg-card shadow-lg p-1 min-w-[120px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const favoriteTools = aiModels.filter(ai => favorites.has(ai.id))
                          const csv = exportFavoritesToCSV(favoriteTools)
                          downloadFile(csv, `my-favorites-${Date.now()}.csv`, 'text/csv')
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded transition-colors"
                      >
                        Export CSV
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const favoriteTools = aiModels.filter(ai => favorites.has(ai.id))
                          const json = exportFavoritesToJSON(favoriteTools)
                          downloadFile(json, `my-favorites-${Date.now()}.json`, 'application/json')
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded transition-colors"
                      >
                        Export JSON
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2 sm:p-2.5 transition-all touch-manipulation ${viewMode === "grid" ? "bg-accent/20 text-accent" : "hover:bg-muted text-muted-foreground"
                  }`}
                aria-label="Grid view"
              >
                <Grid3x3 className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-2 sm:p-2.5 transition-all touch-manipulation ${viewMode === "list" ? "bg-accent/20 text-accent" : "hover:bg-muted text-muted-foreground"
                  }`}
                aria-label="List view"
              >
                <List className="h-4 w-4 sm:h-5 sm:w-5" />
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
                className={`grid gap-4 sm:gap-6 ${viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 max-w-4xl"
                  }`}
              >
                {filteredAIs.slice(0, 25).map((ai, idx) => (
                  <div key={ai.id} className="relative group">
                    <AICard
                      ai={ai}
                      onClick={() => handleSelectAI(ai)}
                      delay={idx * 0.05}
                      searchQuery={searchQuery}
                      showFavorite={true}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddToComparison(ai)
                      }}
                      className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 rounded-lg bg-background/90 backdrop-blur-md p-1.5 sm:p-2 shadow-lg border border-border/50 hover:bg-background active:scale-110 sm:hover:scale-110 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 touch-manipulation"
                      aria-label={comparisonTools.find((t) => t.id === ai.id) ? "Remove from comparison" : "Add to comparison"}
                      title={comparisonTools.find((t) => t.id === ai.id) ? "Remove from comparison" : "Add to comparison"}
                    >
                      <GitCompare className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors ${comparisonTools.find((t) => t.id === ai.id) ? 'text-accent fill-accent/20' : 'text-muted-foreground hover:text-accent'}`} />
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
                    onClick={() => {
                      const params = new URLSearchParams()
                      if (searchQuery.trim()) params.set('q', encodeURIComponent(searchQuery.trim()))
                      if (selectedCategory) params.set('category', encodeURIComponent(selectedCategory))
                      if (selectedRegion) params.set('region', encodeURIComponent(selectedRegion))
                      if (selectedAccessType) params.set('access', encodeURIComponent(selectedAccessType))
                      router.push(`/ai-tools?${params.toString()}`)
                    }}
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
          className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 rounded-full bg-accent p-2.5 sm:p-3 text-accent-foreground shadow-lg transition-all active:scale-110 sm:hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 touch-manipulation"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
        </motion.button>
      )}

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

    </main>
  )
}
