"use client"

import { useState, useMemo, useEffect } from "react"
import { motion } from "framer-motion"
import { HeroSection } from "@/components/hero-section"
import { EnhancedSearchBar } from "@/components/enhanced-search-bar"
import { searchAIEntries, addToSearchHistory } from "@/lib/search-utils"
import { FilterBar } from "@/components/filter-bar"
import { AICard } from "@/components/ai-card"
import { AIModal } from "@/components/ai-modal"
import { TrendingSection } from "@/components/trending-section"
import { ThemeToggle } from "@/components/theme-toggle"
import { aiEntries, type AIEntry } from "@/lib/ai-data"
import { Grid3x3, List, Loader2 } from "lucide-react"

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedRegion, setSelectedRegion] = useState("")
  const [selectedAccessType, setSelectedAccessType] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedAI, setSelectedAI] = useState<AIEntry | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [aiModels, setAiModels] = useState<AIEntry[]>(aiEntries) // Start with static data as fallback
  const [loading, setLoading] = useState(false) // Start with false so content shows immediately
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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

  // Enhanced search and filter with relevance sorting
  const { results: filteredAIs } = useMemo(() => {
    return searchAIEntries(aiModels, searchQuery, {
      category: selectedCategory,
      region: selectedRegion,
      accessType: selectedAccessType,
    })
  }, [aiModels, searchQuery, selectedCategory, selectedRegion, selectedAccessType])

  const trendingAIs = useMemo(() => {
    return filteredAIs.filter((ai) => ai.isTrending).slice(0, 3)
  }, [filteredAIs])

  const handleSelectAI = (ai: AIEntry) => {
    setSelectedAI(ai)
    setIsModalOpen(true)
  }

  const handleSearch = (query: string) => {
    if (query.trim()) {
      addToSearchHistory(query)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
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
      <TrendingSection trendingAIs={trendingAIs} onSelectAI={handleSelectAI} />

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
              <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
              <p className="text-lg font-semibold text-foreground mb-2">Loading AI models...</p>
              <p className="text-muted-foreground">Fetching latest information from external sources</p>
            </motion.div>
          ) : filteredAIs.length > 0 ? (
            <motion.div
              layout
              className={`grid gap-6 ${
                viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 max-w-4xl"
              }`}
            >
              {filteredAIs.map((ai, idx) => (
                <AICard
                  key={ai.id}
                  ai={ai}
                  onClick={() => handleSelectAI(ai)}
                  delay={idx * 0.05}
                  searchQuery={searchQuery}
                />
              ))}
            </motion.div>
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

      {/* Modal */}
      <AIModal ai={selectedAI} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Footer */}
      <footer className="border-t border-border/50 bg-background/50 py-6 md:py-8 mt-12 md:mt-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground text-center">
            <p>
              © {new Date().getFullYear()} Arcyn Find. All rights reserved.
            </p>
            <p className="text-[10px] sm:text-xs">
              Created by{" "}
              <a
                href="https://github.com/Iph22"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline transition-colors"
              >
                David Iphy
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
