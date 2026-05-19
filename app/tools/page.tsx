"use client"

import React, { Suspense } from "react"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ToolImage } from "@/components/tool-image"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Sparkles, Star, Bookmark, ExternalLink, Menu, X, Filter } from "lucide-react"
import { PremiumSearchInput } from "@/components/premium-search-input"
import { SearchSkeleton } from "@/components/search-skeleton"
import { HighlightedText } from "@/components/search-highlight"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguagePicker } from "@/components/language-picker"
import { ToolDetailModal } from "@/components/enhanced-tool-detail-modal"
import { PricingBadge } from "@/components/pricing-badge"
import { usePreferences } from "@/contexts/preferences-context"
import { useLanguage } from "@/contexts/language-context"
import { useAITools } from "@/lib/hooks/use-ai-tools"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import type { AIEntry } from "@/lib/ai-data"

// Comprehensive category mapping from API/database categories to user-friendly display categories
// Based on actual database categories from analyze-tools.js
const categoryMapping: Record<string, string> = {
  // Direct mappings from database categories
  "Generative AI": "Generative AI",
  "Research & Open Source": "Research & Open Source",
  "ChatBots": "Chatbots",
  "Productivity": "Productivity",
  "Image Generation": "Image Generation",
  "Writing & Content": "Writing & Content",
  "Audio & Music": "Audio & Music",
  "Marketing & Sales": "Marketing",
  "Learning & Education": "Education",
  "Video Generation": "Video Generation",
  "Data & Analytics": "Data & Analytics",
  "Code & Development": "Code & Development",
  "Translation & Language": "Translation",
  "Finance": "Finance",
  "Healthcare": "Healthcare",
  "Customer Service": "Customer Service",
  "Gaming & Entertainment": "Gaming",
  "NLP & Text Analysis": "NLP & Text",
  "AI Agents": "AI Agents",
  "3D & Spatial": "3D & Spatial",
  "Computer Vision": "Computer Vision",
}

// Reverse mapping from display categories to actual database categories
// Maps user-friendly names back to what's actually in the database
const reverseCategoryMapping: Record<string, string[]> = {
  "Generative AI": ["Generative AI"],
  "Chatbots": ["ChatBots"],
  "Image Generation": ["Image Generation"],
  "Video Generation": ["Video Generation"],
  "Audio & Music": ["Audio & Music"],
  "Writing & Content": ["Writing & Content"],
  "Code & Development": ["Code & Development"],
  "Productivity": ["Productivity"],
  "Data & Analytics": ["Data & Analytics"],
  "Marketing": ["Marketing & Sales"],
  "Education": ["Learning & Education"],
  "Research": ["Research & Open Source"],
  "AI Agents": ["AI Agents"],
  "AI Detection": ["AI Detection"],
  "HR & Recruiting": ["HR & Recruiting"],
  "Translation": ["Translation & Language"],
  "NLP & Text": ["NLP & Text Analysis"],
  "Customer Service": ["Customer Service"],
  "Finance": ["Finance"],
  "Healthcare": ["Healthcare"],
  "Gaming": ["Gaming & Entertainment"],
  "3D & Spatial": ["3D & Spatial"],
  "Computer Vision": ["Computer Vision"],
}

// User-friendly display categories matching actual database categories
// Updated after comprehensive recategorization v2
const displayCategories = [
  "All",
  "AI Agents",            // 18.3% - Autonomous AI agents
  "Code & Development",   // 17.7% - Coding tools, IDEs
  "Chatbots",             // 10.2% - ChatGPT, Claude, etc.
  "Writing & Content",    // 8.8% - Content creation
  "Image Generation",     // 8.4% - DALL-E, Midjourney, etc.
  "Productivity",         // 6.0% - Workflow automation
  "Audio & Music",        // 4.7% - Voice, music, audio
  "Data & Analytics",     // 4.0% - Data analysis
  "Education",            // 3.7% - Learning tools
  "Marketing",            // 3.2% - Marketing tools
  "Video Generation",     // 2.3% - Video AI tools
  "AI Detection",         // 1.3% - GPTZero, Originality.ai, etc.
  "HR & Recruiting",      // 1.7% - Resume builders, interview prep
  "Customer Service",     // 1.4% - Support tools
  "Translation",          // 1.2% - Translation tools
  "Research",             // 3.5% - Research & Open Source
]

// Inner component that uses search params
function ToolsContent() {
  const searchParams = useSearchParams()
  // Initialize search from URL if present
  const initialSearch = searchParams.get('search') || ""

  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sidebarOpen, setSidebarOpen] = useState(false) // Hidden by default on mobile
  const [selectedTool, setSelectedTool] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [allTools, setAllTools] = useState<AIEntry[]>([])
  const [favoritedTools, setFavoritedTools] = useState<Set<string>>(new Set())
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null)

  // Filter states
  const [accessType, setAccessType] = useState('all')
  const [region, setRegion] = useState('all')

  const { preferences } = usePreferences()
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth()
  const { t } = useLanguage()

  const ITEMS_PER_PAGE = 24 // Load 24 tools at a time (divisible by 2 and 3 for grid)

  // Debounce search input — 200ms for Google-like speed
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 200) // 200ms — fast enough to feel instant, slow enough to avoid API spam

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
    accessType: accessType === 'all' ? undefined : accessType,
    region: region === 'all' ? undefined : region,
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
  }, [debouncedSearch, selectedCategory, accessType, region])

  // Load favorited tools
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && user) {
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
  }, [isAuthLoading, isAuthenticated, user])

  const handleToggleFavorite = async (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!user) {
      toast.error(t("tools.signInToSave"))
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
      image: tool.image || null, // Use database image URL
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

  // Client-side search filtering is redundant since the API handles it.
  // We just use the sorted tools returned from the API.
  const filteredTools = sortedTools

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar - Show as drawer on mobile, fixed on desktop */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <>
            {/* Mobile overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
            />
            {/* Sidebar - Mobile drawer or desktop fixed */}
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-40 h-full w-72 md:w-72"
            >
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden pb-20 md:pb-0">
        {/* Header */}
        <motion.header
          className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-20"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
            <div className="flex items-center gap-2 md:gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-9 w-9 md:h-10 md:w-10">
                {sidebarOpen ? <X className="h-4 w-4 md:h-5 md:w-5" /> : <Menu className="h-4 w-4 md:h-5 md:w-5" />}
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-base md:text-lg font-bold">{t("nav.tools")}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguagePicker />
              <ThemeToggle />
            </div>
          </div>
        </motion.header>

        {/* Tools Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 md:px-6 md:py-8 md:pb-8 mb-20 md:mb-0">
            {/* Personalized Welcome Message */}
            {preferences?.categories && preferences.categories.length > 0 && (
              <motion.div
                className="mb-4 md:mb-6 rounded-xl border border-primary/20 bg-primary/5 p-3 md:p-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-xs md:text-sm text-foreground">
                  <span className="font-semibold text-primary">{t("search.personalized")}:</span> Showing tools matched to
                  your interests in {preferences.categories.slice(0, 2).join(", ")}
                  {preferences.categories.length > 2 && ` and ${preferences.categories.length - 2} more`}.
                </p>
              </motion.div>
            )}

            {/* Search & Filter Bar */}
            <motion.div
              className="mb-6 md:mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="mb-4 md:mb-6 flex flex-col gap-3 md:gap-4 sm:flex-row">
                <PremiumSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t("search.placeholder")}
                  className="flex-1"
                  showButton={false}
                  onFocus={() => {
                    // Handle mobile scroll
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      setTimeout(() => {
                        const element = document.activeElement
                        element?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                          inline: 'nearest'
                        })
                      }, 100)
                    }
                  }}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="lg" className="h-11 md:h-14 gap-2 px-4 md:px-6 bg-transparent shrink-0">
                      <Filter className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("search.filters")}</span>
                      {(accessType !== 'all' || region !== 'all') && (
                        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-5" align="end">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold leading-none">{t("search.filters")}</h4>
                        {(accessType !== 'all' || region !== 'all') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setAccessType('all')
                              setRegion('all')
                            }}
                          >
                            {t("search.reset")}
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-muted-foreground">{t("search.pricingModel")}</h5>
                        <div className="grid grid-cols-2 gap-2">
                          {['all', 'Free', 'Freemium', 'Paid', 'Free Trial'].map((type) => (
                            <Button
                              key={type}
                              variant={accessType === type ? "default" : "outline"}
                              size="sm"
                              className="justify-start"
                              onClick={() => setAccessType(type)}
                            >
                              {type === 'all' ? t("search.anyPrice") : type}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-muted-foreground">{t("search.region")}</h5>
                        <Select value={region} onValueChange={setRegion}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("search.selectRegion")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t("search.region")} — {t("search.anyPrice").replace("Price", "Region")}</SelectItem>
                            <SelectItem value="Global">Global</SelectItem>
                            <SelectItem value="USA">🇺🇸 United States</SelectItem>
                            <SelectItem value="EU">🇪🇺 Europe</SelectItem>
                            <SelectItem value="Asia">Asia</SelectItem>
                            <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Category Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                {displayCategories.map((category) => (
                  <motion.button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`whitespace-nowrap rounded-xl px-4 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-medium transition-all shrink-0 ${selectedCategory === category
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

            {/* Loading State — Premium skeleton cards instead of spinner */}
            {isLoading && allTools.length === 0 && (
              <SearchSkeleton count={6} />
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
                className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <AnimatePresence mode="popLayout">
                  {filteredTools.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                      <p className="text-muted-foreground">{t("search.noToolsFound")}. {t("search.tryAdjusting")}</p>
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
                          <div className="relative h-40 md:h-48 overflow-hidden bg-muted">
                            <ToolImage
                              src={tool.image}
                              alt={tool.name}
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              fallbackText={tool.name}
                            />
                            {tool.featured && (
                              <Badge className="absolute right-3 top-3 bg-primary/90 text-primary-foreground backdrop-blur-sm">
                                <Sparkles className="mr-1 h-3 w-3" />
                                {t("tools.featured")}
                              </Badge>
                            )}
                          </div>

                          {/* Tool Info */}
                          <div className="p-4 md:p-5">
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <h3 className="text-base md:text-lg font-semibold leading-tight">
                                <HighlightedText text={tool.name} query={debouncedSearch} />
                              </h3>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 rounded-lg"
                                onClick={(e) => handleToggleFavorite(tool.id, e)}
                                disabled={togglingFavorite === tool.id || !user}
                                title={favoritedTools.has(tool.id) ? t("tools.removeFromFavorites") : t("tools.addToFavorites")}
                              >
                                <Bookmark className={`h-4 w-4 ${favoritedTools.has(tool.id) ? 'fill-primary text-primary' : ''}`} />
                              </Button>
                            </div>

                            <p className="mb-3 md:mb-4 line-clamp-2 text-xs md:text-sm text-muted-foreground leading-relaxed">
                              <HighlightedText text={tool.description || ''} query={debouncedSearch} />
                            </p>

                            <div className="mb-3 md:mb-4 flex items-center gap-2 flex-wrap">
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
                              <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
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
                                {t("tools.details")}
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
              <div className="mt-8 mb-6 md:mb-8 text-center">
                <Button
                  size="lg"
                  onClick={() => setPage(prev => prev + 1)}
                  className="gap-2"
                >
                  {t("search.loadMore")}
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <p className="mt-2 text-xs md:text-sm text-muted-foreground">
                  {t("search.showing", { count: String(filteredTools.length) })}
                </p>
              </div>
            )}

            {/* Loading More Indicator */}
            {isLoading && allTools.length > 0 && (
              <div className="mt-8 mb-6 md:mb-8 flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && filteredTools.length === 0 && (
              <motion.div className="py-12 md:py-20 mb-6 md:mb-8 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mx-auto mb-4 flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-muted">
                  <Search className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-base md:text-lg font-semibold">{t("search.noToolsFound")}</h3>
                <p className="text-sm md:text-base text-muted-foreground">{t("search.tryAdjusting")}</p>
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

// Wrapper component with Suspense
export default function ToolsPage() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <React.Suspense fallback={
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }>
        <ToolsContent />
      </React.Suspense>
    </div>
  )
}
