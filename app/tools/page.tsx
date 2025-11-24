"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Sparkles, Star, Bookmark, ExternalLink, Menu, X, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { ToolDetailModal } from "@/components/enhanced-tool-detail-modal"
import { PricingBadge } from "@/components/pricing-badge"
import { usePreferences } from "@/contexts/preferences-context"
import { useAITools } from "@/lib/hooks/use-ai-tools"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import type { AIEntry } from "@/lib/ai-data"

// Comprehensive category mapping from API/database categories to user-friendly display categories
// Based on industry standards and actual database categories
const categoryMapping: Record<string, string> = {
  // Text & Content Generation
  "Text Generation": "Content Generation",
  "Generative AI": "Content Generation",
  "AI Writing": "Content Generation",
  
  // Image & Visual
  "Image Generation": "Image Generation",
  "Computer Vision": "Image Generation",
  
  // Code & Development
  "Code Generation": "Code Assistants",
  "Code Assistants": "Code Assistants",
  
  // Audio & Speech
  "Audio/NLP": "Voice & Speech",
  "NLP Platform": "Voice & Speech",
  "Audio": "Voice & Speech",
  "Audio/Video Processing": "Voice & Speech",
  
  // Video
  "Video Generation": "Video & Audio",
  "Video": "Video & Audio",
  
  // Chatbots & Conversational
  "ChatBots": "Chatbots",
  "Chatbots": "Chatbots",
  "Conversational AI": "Chatbots",
  
  // Data & Analytics
  "Data Analytics": "Data & Analytics",
  "Data Analysis": "Data & Analytics",
  "ML Infrastructure": "Data & Analytics",
  
  // AI Detection
  "AI Detection": "AI Detection",
  "AI Detection Tool": "AI Detection",
  
  // Productivity & Business
  "Productivity": "Productivity",
  "Autonomous AI": "Productivity",
  "Business Automation": "Productivity",
  
  // Marketing
  "Marketing": "Marketing",
  "Marketing Automation": "Marketing",
  
  // Design
  "Design": "Design",
  "Design Assistance": "Design",
  
  // Research & Education
  "Research": "Research & Education",
  "Learning & Education": "Research & Education",
  "Search/QA": "Research & Education",
  "Education": "Research & Education",
  
  // Multimodal & Platforms
  "Multimodal Platform": "Multimodal AI",
  "Multimodal": "Multimodal AI",
}

// Reverse mapping from display categories to API/database categories
// Maps user-friendly names back to what's actually in the database
// Note: Many chatbots are categorized as "Generative AI" in the database
const reverseCategoryMapping: Record<string, string[]> = {
  "Content Generation": ["Text Generation", "AI Writing", "Generative AI"],
  "Image Generation": ["Image Generation", "Computer Vision"],
  "Code Assistants": ["Code Generation", "Code Assistants"],
  "Voice & Speech": ["Audio/NLP", "NLP Platform", "Audio", "Audio/Video Processing"],
  "Video & Audio": ["Video Generation", "Video"],
  // Chatbots: Include Generative AI since most LLMs (ChatGPT, Claude, etc.) are chatbots
  "Chatbots": ["ChatBots", "Chatbots", "Conversational AI", "Generative AI"],
  "Data & Analytics": ["Data Analytics", "Data Analysis", "ML Infrastructure"],
  "AI Detection": ["AI Detection", "AI Detection Tool"],
  "Productivity": ["Productivity", "Autonomous AI", "Business Automation"],
  // Marketing: May be under various categories, also check tags/descriptions
  "Marketing": ["Marketing", "Marketing Automation"],
  // Design: Tools might be under Computer Vision or other categories
  "Design": ["Design", "Design Assistance"],
  "Research & Education": ["Research", "Learning & Education", "Search/QA", "Education"],
  "Multimodal AI": ["Multimodal Platform", "Multimodal"],
}

// User-friendly display categories in order of popularity/importance
const displayCategories = [
  "All",
  "Content Generation",      // Writing, text generation, LLMs
  "Image Generation",          // DALL-E, Midjourney, etc.
  "Code Assistants",          // GitHub Copilot, etc.
  "Chatbots",                 // ChatGPT, Claude, etc.
  "Video & Audio",            // Video generation and editing
  "Voice & Speech",           // TTS, STT, voice AI
  "Data & Analytics",         // Data analysis, ML infrastructure
  "Productivity",             // Automation, workflow tools
  "Marketing",                // Marketing automation
  "Design",                   // Design tools
  "Research & Education",     // Research, learning, education
  "AI Detection",             // AI detection tools
  "Multimodal AI",            // Multimodal platforms
]

export default function ToolsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sidebarOpen, setSidebarOpen] = useState(false) // Hidden by default on mobile
  const [selectedTool, setSelectedTool] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [allTools, setAllTools] = useState<AIEntry[]>([])
  const [favoritedTools, setFavoritedTools] = useState<Set<string>>(new Set())
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null)
  const { preferences } = usePreferences()
  const { user, isLoaded } = useUser()

  const ITEMS_PER_PAGE = 24 // Load 24 tools at a time (divisible by 2 and 3 for grid)

  // Debounce search input to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Map display category to API category
  // Since reverse mapping can have multiple categories, join them with comma
  // The API will use OR logic to match any of them
  const getApiCategory = () => {
    if (selectedCategory === "All") return undefined
    
    const mapping = reverseCategoryMapping[selectedCategory]
    if (Array.isArray(mapping)) {
      return mapping.join(',')
    }
    return mapping || selectedCategory
  }
  
  const apiCategory = getApiCategory()

  // Fetch AI tools from API with pagination
  const { tools: apiTools, isLoading, error, hasMore } = useAITools({
    searchQuery: debouncedSearch || undefined,
    category: apiCategory,
    limit: ITEMS_PER_PAGE,
    offset: (page - 1) * ITEMS_PER_PAGE,
  })

  // Accumulate tools from multiple pages
  useEffect(() => {
    if (apiTools.length > 0) {
      if (page === 1) {
        // First page: replace all tools
        setAllTools(apiTools)
      } else {
        // Subsequent pages: append new tools (avoid duplicates)
        setAllTools(prev => {
          const existingIds = new Set(prev.map(t => t.id))
          const newTools = apiTools.filter(t => !existingIds.has(t.id))
          return [...prev, ...newTools]
        })
      }
    } else if (page === 1) {
      // No results on first page: clear tools
      setAllTools([])
    }
  }, [apiTools, page])

  // Reset tools and page when debounced search or category changes
  useEffect(() => {
    setAllTools([])
    setPage(1)
  }, [debouncedSearch, selectedCategory])

  // Load favorited tools
  useEffect(() => {
    if (isLoaded && user) {
      const loadFavorites = async () => {
        try {
          const response = await fetch('/api/favorites')
          if (response.ok) {
            const data = await response.json()
            const favoriteIds = new Set<string>((data.favorites || []).map((f: any) => String(f.tool_id)))
            setFavoritedTools(favoriteIds)
          }
        } catch (error) {
          console.error('Error loading favorites:', error)
        }
      }
      loadFavorites()
    }
  }, [isLoaded, user])

  const handleToggleFavorite = async (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!user) {
      toast.error("Please sign in to save tools")
      return
    }

    setTogglingFavorite(toolId)
    const isFavorited = favoritedTools.has(toolId)

    try {
      let response: Response
      
      if (isFavorited) {
        // Remove favorite
        response = await fetch(`/api/favorites/${toolId}`, { method: 'DELETE' })
      } else {
        // Add favorite - use POST with tool_id in body
        response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_id: toolId })
        })
      }
      
      if (response.ok) {
        if (isFavorited) {
          setFavoritedTools(prev => {
            const next = new Set(prev)
            next.delete(toolId)
            return next
          })
          toast.success("Removed from favorites")
        } else {
          setFavoritedTools(prev => new Set(prev).add(toolId))
          toast.success("Added to favorites")
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 409) {
          // Already favorited, just update UI
          setFavoritedTools(prev => new Set(prev).add(toolId))
        } else {
          toast.error(errorData.error || "Failed to update favorite")
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
      toast.error("An error occurred")
    } finally {
      setTogglingFavorite(null)
    }
  }

  // Map API tools to display format
  const tools = useMemo(() => {
    return allTools.map((tool: AIEntry) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: categoryMapping[tool.category] || tool.category,
      rating: (tool.popularity / 20).toFixed(1), // Convert popularity (0-100) to rating (0-5)
      saves: Math.floor(tool.popularity * 100), // Estimate saves from popularity
      image: `/ai-tools/${tool.id}.png`, // Generated image path
      featured: tool.isTrending || false,
      platform: tool.platform,
      accessType: tool.accessType,
      pricing: tool.pricing,
      tags: tool.tags,
    }))
  }, [allTools])

  const getSortedTools = () => {
    if (!preferences?.categories || preferences.categories.length === 0) {
      return tools
    }

    const userCategoryMapping: Record<string, string> = {
      text: "AI Writing",
      vision: "Image Generation",
      coding: "Code Assistants",
      research: "Data Analysis",
    }

    const userPreferredCategories = preferences.categories.map((cat) => userCategoryMapping[cat]).filter(Boolean)

    const prioritized = tools.slice().sort((a, b) => {
      const aMatch = userPreferredCategories.includes(a.category)
      const bMatch = userPreferredCategories.includes(b.category)
      if (aMatch && !bMatch) return -1
      if (!aMatch && bMatch) return 1
      // Sort by featured/trending, then by saves
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      return b.saves - a.saves
    })

    return prioritized
  }

  const sortedTools = getSortedTools()

  // Client-side search filtering (category filtering is done server-side via API)
  // Only filter by search if search is being done client-side (for already loaded tools)
  // Note: If search is passed to API, it's handled server-side, so this is mainly for
  // filtering already-loaded tools when user types quickly
  const filteredTools = sortedTools.filter((tool) => {
    // If we have a search query, the API handles it, but we can still do client-side
    // filtering for better UX on already-loaded tools
    if (debouncedSearch) {
      return tool.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        tool.description.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        tool.tags?.some((tag) => tag.toLowerCase().includes(debouncedSearch.toLowerCase()))
    }
    // No search query - show all tools (category already filtered by API)
    return true
  })

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Hidden on mobile */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <>
            {/* Mobile overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
            />
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="hidden md:block fixed inset-y-0 left-0 z-40 h-full w-72"
            >
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden pb-16 md:pb-0">
        {/* Header */}
        <motion.header
          className="border-b border-border/40 bg-card/50 backdrop-blur-xl"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-10 w-10">
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <div className="flex items-center gap-2">
                
                <span className="text-lg font-bold">AI Tools</span>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </motion.header>

        {/* Tools Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-8">
            {/* Personalized Welcome Message */}
            {preferences?.categories && preferences.categories.length > 0 && (
              <motion.div
                className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-sm text-foreground">
                  <span className="font-semibold text-primary">Personalized results:</span> Showing tools matched to
                  your interests in {preferences.categories.slice(0, 2).join(", ")}
                  {preferences.categories.length > 2 && ` and ${preferences.categories.length - 2} more`}.
                </p>
              </motion.div>
            )}

            {/* Search & Filter Bar */}
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="mb-6 flex flex-col gap-4 sm:flex-row">
                <Card className="flex-1 overflow-hidden border-border/50 bg-card/50 p-2 backdrop-blur-sm">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search AI tools..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-12 border-0 bg-transparent pl-12 text-base focus-visible:ring-0"
                    />
                  </div>
                </Card>
                <Button variant="outline" size="lg" className="h-14 gap-2 px-6 bg-transparent">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
              </div>

              {/* Category Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                 {displayCategories.map((category) => (
                  <motion.button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`whitespace-nowrap rounded-xl px-6 py-2.5 text-sm font-medium transition-all ${
                      selectedCategory === category
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-card/50 text-foreground hover:bg-accent"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {category}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-muted-foreground">Loading AI tools...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <p className="mb-4 text-destructive">{error}</p>
                  <Button onClick={() => window.location.reload()}>Retry</Button>
                </div>
              </div>
            )}

            {/* Tools Grid */}
            {!isLoading && !error && (
              <motion.div
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <AnimatePresence mode="popLayout">
                  {filteredTools.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                      <p className="text-muted-foreground">No tools found. Try adjusting your filters.</p>
                    </div>
                  ) : (
                    filteredTools.map((tool, index) => (
                  <motion.div
                    key={tool.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card 
                      className="group relative h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-lg cursor-pointer"
                      onClick={() => setSelectedTool(tool)}
                    >
                      {/* Tool Image */}
                      <div className="relative h-48 overflow-hidden bg-muted">
                        <img
                          src={tool.image || "/placeholder.svg"}
                          alt={tool.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {tool.featured && (
                          <Badge className="absolute right-3 top-3 bg-primary/90 text-primary-foreground backdrop-blur-sm">
                            <Sparkles className="mr-1 h-3 w-3" />
                            Featured
                          </Badge>
                        )}
                      </div>

                      {/* Tool Info */}
                      <div className="p-5">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="text-lg font-semibold leading-tight">{tool.name}</h3>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 shrink-0 rounded-lg"
                            onClick={(e) => handleToggleFavorite(tool.id, e)}
                            disabled={togglingFavorite === tool.id || !user}
                            title={favoritedTools.has(tool.id) ? "Remove from favorites" : "Add to favorites"}
                          >
                            <Bookmark className={`h-4 w-4 ${favoritedTools.has(tool.id) ? 'fill-primary text-primary' : ''}`} />
                          </Button>
                        </div>

                        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                          {tool.description}
                        </p>

                        <div className="mb-4 flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {tool.category}
                          </Badge>
                          <PricingBadge 
                            pricing={tool.pricing} 
                            accessType={tool.accessType} 
                            size="sm"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-primary text-primary" />
                              <span className="font-medium">{tool.rating}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Bookmark className="h-4 w-4" />
                              <span>{(tool.saves / 1000).toFixed(1)}K</span>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="gap-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTool(tool)
                            }}
                          >
                            Details
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Load More Button */}
            {!isLoading && !error && filteredTools.length > 0 && hasMore && (
              <div className="mt-8 text-center">
                <Button
                  size="lg"
                  onClick={() => setPage(prev => prev + 1)}
                  className="gap-2"
                >
                  Load More Tools
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <p className="mt-2 text-sm text-muted-foreground">
                  Showing {filteredTools.length} tools. Click to load more.
                </p>
              </div>
            )}

            {/* Loading More Indicator */}
            {isLoading && allTools.length > 0 && (
              <div className="mt-8 flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && filteredTools.length === 0 && (
              <motion.div className="py-20 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No tools found</h3>
                <p className="text-muted-foreground">Try adjusting your search or filters</p>
              </motion.div>
            )}
          </div>
        </main>
      </div>
      
      {/* Tool Detail Modal */}
      <ToolDetailModal
        tool={selectedTool}
        isOpen={!!selectedTool}
        onClose={() => setSelectedTool(null)}
      />
    </div>
  )
}
