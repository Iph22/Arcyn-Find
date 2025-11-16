"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Grid3x3, List, ChevronLeft, ChevronRight, GitCompare } from "lucide-react"
import { AICard } from "@/components/ai-card"
import { FilterBar } from "@/components/filter-bar"
import { EnhancedSearchBar } from "@/components/enhanced-search-bar"
import { searchAIEntries, addToSearchHistory } from "@/lib/search-utils"
import { aiEntries, type AIEntry } from "@/lib/ai-data"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"

const ITEMS_PER_PAGE = 12
const COMPARISON_STORAGE_KEY = 'arcyn-find-comparison-tools'

export default function AllAIToolsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedRegion, setSelectedRegion] = useState("")
  const [selectedAccessType, setSelectedAccessType] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [currentPage, setCurrentPage] = useState(1)
  const [aiModels, setAiModels] = useState<AIEntry[]>(aiEntries)
  const [loading, setLoading] = useState(false)
  const [infiniteScroll, setInfiniteScroll] = useState(false)
  const [comparisonTools, setComparisonTools] = useState<AIEntry[]>([])

  // Fetch AI models from API
  useEffect(() => {
    async function fetchModels() {
      try {
        setLoading(true)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        
        const response = await fetch('/api/ai-models', {
          cache: 'no-store',
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0) {
            setAiModels(data)
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn('API request timed out, using fallback data')
        } else {
          console.error('Failed to fetch AI models, using fallback data:', error)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchModels()
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
    return searchAIEntries(aiModels, searchQuery, {
      category: selectedCategory,
      region: selectedRegion,
      accessType: selectedAccessType,
    })
  }, [aiModels, searchQuery, selectedCategory, selectedRegion, selectedAccessType])

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory, selectedRegion, selectedAccessType])

  // Infinite scroll or pagination
  const displayedAIs = infiniteScroll
    ? filteredAIs.slice(0, currentPage * ITEMS_PER_PAGE)
    : filteredAIs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const totalPages = Math.ceil(filteredAIs.length / ITEMS_PER_PAGE)
  const startIndex = infiniteScroll ? 0 : (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = infiniteScroll ? displayedAIs.length : startIndex + ITEMS_PER_PAGE
  const hasMore = infiniteScroll && displayedAIs.length < filteredAIs.length

  // Infinite scroll observer
  useEffect(() => {
    if (!infiniteScroll || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCurrentPage((prev) => prev + 1)
        }
      },
      { threshold: 0.1 }
    )

    const sentinel = document.getElementById('infinite-scroll-sentinel')
    if (sentinel) {
      observer.observe(sentinel)
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel)
      }
    }
  }, [infiniteScroll, hasMore])

  const handleSelectAI = (ai: AIEntry) => {
    router.push(`/ai/${ai.id}`)
  }

  const handleSearch = (query: string) => {
    if (query.trim()) {
      addToSearchHistory(query)
    }
  }

  const handleAddToComparison = (ai: AIEntry) => {
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
  }

  const handleOpenComparison = () => {
    if (comparisonTools.length > 0) {
      router.push('/compare')
    }
  }

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <section className="border-b border-border/50 bg-background/50 py-4 sm:py-6 md:py-8">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-4 flex items-center justify-between">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => router.back()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </motion.button>
            <ThemeToggle />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <EnhancedSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                aiModels={aiModels}
                onSearch={handleSearch}
              />
            </div>
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

      {/* Main Content */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          {/* Header with View Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">All AI Tools</h1>
              <p className="mt-2 text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredAIs.length)} of {filteredAIs.length} {filteredAIs.length === 1 ? "result" : "results"}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleOpenComparison}
                disabled={comparisonTools.length === 0}
                className={`rounded-lg p-2.5 sm:p-2 transition-all touch-manipulation relative ${
                  comparisonTools.length > 0 
                    ? 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer' 
                    : 'text-muted-foreground/30 cursor-not-allowed opacity-50'
                }`}
                aria-label={comparisonTools.length > 0 ? `Compare ${comparisonTools.length} tools` : "No tools in comparison"}
                title={comparisonTools.length > 0 ? `Compare ${comparisonTools.length} tool${comparisonTools.length > 1 ? 's' : ''}` : "Add tools to comparison first"}
              >
                <GitCompare className="h-5 w-5" />
                {comparisonTools.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground animate-pulse">
                    {comparisonTools.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setInfiniteScroll(!infiniteScroll)}
                className={`rounded-lg px-3 py-2 text-sm transition-all touch-manipulation ${
                  infiniteScroll ? "bg-accent/20 text-accent" : "hover:bg-muted text-muted-foreground"
                }`}
                aria-label={infiniteScroll ? "Switch to pagination" : "Switch to infinite scroll"}
                title={infiniteScroll ? "Switch to pagination" : "Switch to infinite scroll"}
              >
                {infiniteScroll ? "Pagination" : "Infinite Scroll"}
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2.5 sm:p-2 transition-all touch-manipulation ${
                  viewMode === "grid" ? "bg-accent/20 text-accent" : "hover:bg-muted text-muted-foreground"
                }`}
                aria-label="Grid view"
              >
                <Grid3x3 className="h-5 w-5 sm:h-5 sm:w-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-2.5 sm:p-2 transition-all touch-manipulation ${
                  viewMode === "list" ? "bg-accent/20 text-accent" : "hover:bg-muted text-muted-foreground"
                }`}
                aria-label="List view"
              >
                <List className="h-5 w-5 sm:h-5 sm:w-5" />
              </button>
            </div>
          </motion.div>

          {/* AI Grid/List */}
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card/30 py-12"
            >
              <p className="text-lg font-semibold text-foreground mb-2">Loading AI models...</p>
            </motion.div>
          ) : filteredAIs.length > 0 ? (
            <>
              <motion.div
                layout
                className={`grid gap-6 ${
                  viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 max-w-4xl"
                }`}
              >
                {displayedAIs.map((ai, idx) => (
                  <div key={ai.id} className="relative group">
                    <AICard
                      ai={ai}
                      onClick={() => handleSelectAI(ai)}
                      delay={idx * 0.02}
                      searchQuery={searchQuery}
                      showFavorite={true}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddToComparison(ai)
                      }}
                      className="absolute top-3 right-3 z-20 rounded-lg bg-background/90 backdrop-blur-md p-2 shadow-lg border border-border/50 hover:bg-background hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                      aria-label={comparisonTools.find((t) => t.id === ai.id) ? "Remove from comparison" : "Add to comparison"}
                      title={comparisonTools.find((t) => t.id === ai.id) ? "Remove from comparison" : "Add to comparison"}
                    >
                      <GitCompare className={`h-4 w-4 transition-colors ${comparisonTools.find((t) => t.id === ai.id) ? 'text-accent fill-accent/20' : 'text-muted-foreground hover:text-accent'}`} />
                    </button>
                  </div>
                ))}
              </motion.div>

              {/* Infinite scroll sentinel */}
              {infiniteScroll && hasMore && (
                <div id="infinite-scroll-sentinel" className="h-10 w-full" />
              )}

              {/* Pagination Controls */}
              {!infiniteScroll && totalPages > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and pages around current
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => goToPage(page)}
                            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                              currentPage === page
                                ? "bg-accent text-accent-foreground"
                                : "border border-border bg-card text-foreground hover:bg-muted"
                            }`}
                            aria-label={`Go to page ${page}`}
                            aria-current={currentPage === page ? "page" : undefined}
                          >
                            {page}
                          </button>
                        )
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="px-2 text-muted-foreground">...</span>
                      }
                      return null
                    })}
                  </div>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
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
      <Footer />
    </div>
  )
}

