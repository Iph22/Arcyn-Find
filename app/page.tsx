"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { HeroSection } from "@/components/hero-section"
import { SearchBar } from "@/components/search-bar"
import { FilterBar } from "@/components/filter-bar"
import { AICard } from "@/components/ai-card"
import { AIModal } from "@/components/ai-modal"
import { TrendingSection } from "@/components/trending-section"
import { ThemeToggle } from "@/components/theme-toggle"
import { aiEntries, type AIEntry } from "@/lib/ai-data"
import { Grid3x3, List } from "lucide-react"

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedRegion, setSelectedRegion] = useState("")
  const [selectedAccessType, setSelectedAccessType] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedAI, setSelectedAI] = useState<AIEntry | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Filter AI entries
  const filteredAIs = useMemo(() => {
    return aiEntries.filter((ai) => {
      const matchesSearch =
        !searchQuery ||
        ai.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ai.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ai.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCategory = !selectedCategory || ai.category === selectedCategory
      const matchesRegion = !selectedRegion || ai.region === selectedRegion
      const matchesAccessType = !selectedAccessType || ai.accessType === selectedAccessType

      return matchesSearch && matchesCategory && matchesRegion && matchesAccessType
    })
  }, [searchQuery, selectedCategory, selectedRegion, selectedAccessType])

  const trendingAIs = useMemo(() => {
    return filteredAIs.filter((ai) => ai.isTrending).slice(0, 3)
  }, [filteredAIs])

  const handleSelectAI = (ai: AIEntry) => {
    setSelectedAI(ai)
    setIsModalOpen(true)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <HeroSection />

      {/* Search Section */}
      <section className="border-b border-border/50 bg-background/50 py-8">
        <div className="mx-auto max-w-7xl px-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <ThemeToggle />
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
            className="mb-8 flex items-center justify-between"
          >
            <div>
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">All AI Tools</h2>
              <p className="mt-2 text-muted-foreground">
                {filteredAIs.length} {filteredAIs.length === 1 ? "result" : "results"}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2 transition-all ${
                  viewMode === "grid" ? "bg-accent/20 text-accent" : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <Grid3x3 className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-2 transition-all ${
                  viewMode === "list" ? "bg-accent/20 text-accent" : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </motion.div>

          {/* AI Grid/List */}
          {filteredAIs.length > 0 ? (
            <motion.div
              layout
              className={`grid gap-6 ${
                viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 max-w-4xl"
              }`}
            >
              {filteredAIs.map((ai, idx) => (
                <AICard key={ai.id} ai={ai} onClick={() => handleSelectAI(ai)} delay={idx * 0.05} />
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
    </main>
  )
}
