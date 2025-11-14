"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Grid3x3, List } from "lucide-react"
import { AICard } from "@/components/ai-card"
import { FilterBar } from "@/components/filter-bar"
import { EnhancedSearchBar } from "@/components/enhanced-search-bar"
import { searchAIEntries, addToSearchHistory } from "@/lib/search-utils"
import { aiEntries, type AIEntry } from "@/lib/ai-data"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AllAIToolsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedRegion, setSelectedRegion] = useState("")
  const [selectedAccessType, setSelectedAccessType] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [aiModels, setAiModels] = useState<AIEntry[]>(aiEntries)
  const [loading, setLoading] = useState(false)

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

  // Enhanced search and filter with relevance sorting
  const { results: filteredAIs } = useMemo(() => {
    return searchAIEntries(aiModels, searchQuery, {
      category: selectedCategory,
      region: selectedRegion,
      accessType: selectedAccessType,
    })
  }, [aiModels, searchQuery, selectedCategory, selectedRegion, selectedAccessType])

  const handleSelectAI = (ai: AIEntry) => {
    router.push(`/ai/${ai.id}`)
  }

  const handleSearch = (query: string) => {
    if (query.trim()) {
      addToSearchHistory(query)
    }
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
                {filteredAIs.length} {filteredAIs.length === 1 ? "result" : "results"}
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
              <p className="text-lg font-semibold text-foreground mb-2">Loading AI models...</p>
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
                  delay={idx * 0.02}
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
    </div>
  )
}

