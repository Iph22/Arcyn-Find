"use client"

import React, { Suspense } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ToolImage } from "@/components/tools/tool-image"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Star, Bookmark, ExternalLink, Menu, X, Filter } from "lucide-react"
import { PremiumSearchInput } from "@/components/search/premium-search-input"
import { SearchSkeleton } from "@/components/search/search-skeleton"
import { RecommendationPanel } from "@/components/recommend/recommendation-panel"
import { HighlightedText } from "@/components/search/search-highlight"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { LanguagePicker } from "@/components/layout/language-picker"
// Code-split: a 649-line modal (framer-motion + several Radix dialogs) that's
// invisible until a card is clicked shouldn't ship in this page's main bundle.
const ToolDetailModal = dynamic(
  () => import("@/components/tools/enhanced-tool-detail-modal").then((mod) => mod.ToolDetailModal),
  { ssr: false }
)
import { PricingBadge } from "@/components/tools/pricing-badge"
import { CompareToggle } from "@/components/compare/compare-toggle"
import { CompareTray, CompareTraySpacer } from "@/components/compare/compare-tray"
import { usePreferences } from "@/contexts/preferences-context"
import { useLanguage } from "@/contexts/language-context"
import { useAITools } from "@/lib/hooks/use-ai-tools"
import { useRecommendation } from "@/lib/hooks/use-recommendation"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import type { AIEntry } from "@/lib/ai-data"
import { toolHref } from "@/lib/tool-href"
import { addRecentSearch } from "@/lib/recent-searches"
import {
  CATEGORY_SLUG_TO_DISPLAY,
  categoryMapping,
  displayCategories,
  reverseCategoryMapping,
} from "@/lib/categories"

const PRICE_CAPS: (number | null)[] = [null, 10, 25, 50, 100]


// Inner component that uses search params
function ToolsContent() {
  const searchParams = useSearchParams()
  // Initialize search from URL if present
  const initialSearch = searchParams.get('search') || ""

  const [searchQuery, setSearchQuery] = useState(initialSearch)
  // Seeded from the URL, not "". A search arriving via `?search=` has already
  // been committed by the user -- there is nothing to debounce. Starting empty
  // meant the first render fetched the UNFILTERED list, rendered it, and only
  // replaced it ~450ms later when the debounce caught up: arriving from a
  // search showed a screenful of wrong results first.
  const [committedSearch, setCommittedSearch] = useState(initialSearch)
  // `?category=` lets the rest of the app open this browser already filtered,
  // which is what an in-app category tile should do. An unrecognised slug
  // falls back to "All" rather than filtering to nothing.
  const [selectedCategory, setSelectedCategory] = useState(
    () => CATEGORY_SLUG_TO_DISPLAY[searchParams.get("category") || ""] || "All"
  )
  const [sidebarOpen, setSidebarOpen] = useState(false) // Hidden by default on mobile
  const [selectedTool, setSelectedTool] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [allTools, setAllTools] = useState<AIEntry[]>([])
  const [favoritedTools, setFavoritedTools] = useState<Set<string>>(new Set())
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null)

  // Filter states
  const [accessType, setAccessType] = useState('all')
  const [region, setRegion] = useState('all')
  // Cap on the cheapest paid tier, USD/month. null = no cap.
  const [maxPrice, setMaxPrice] = useState<number | null>(null)

  const { preferences } = usePreferences()
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth()
  const { t } = useLanguage()

  const ITEMS_PER_PAGE = 24 // Load 24 tools at a time (divisible by 2 and 3 for grid)

  // Search runs when the reader says it does -- Enter, or the button -- and
  // not before.
  //
  // This was a 450ms debounce on every keystroke, which meant a half-typed
  // thought was sent as a real query: "I want to create a 30 sec" ran, and so
  // did "I want to create a 30 secs long video, i nee". Each one hit
  // /api/ai-models AND /api/recommend, so a single sentence could spend
  // several AI calls answering questions nobody asked, and the results list
  // churned under the reader while they were still typing.
  //
  // A search box that fires on its own also cannot be got wrong slowly: there
  // is no moment where you have typed the query and not yet asked for it, so
  // the reader never gets to finish the sentence.
  const submitSearch = useCallback(() => {
    const next = searchQuery.trim()
    setCommittedSearch(next)
    setPage(1)
    if (next) addRecentSearch(next)
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
  // Shares the SAME debounced value as the search below, so a reasoning call
  // can't fire per keystroke. Runs in parallel with the search, not before it.
  const { recommendation, isLoading: isRecommendationLoading } = useRecommendation(
    committedSearch || undefined
  )

  const { tools: apiTools, isLoading, error, hasMore } = useAITools({
    searchQuery: committedSearch || undefined,
    category: apiCategory,
    accessType: accessType === 'all' ? undefined : accessType,
    region: region === 'all' ? undefined : region,
    maxPrice: maxPrice ?? undefined,
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
  }, [committedSearch, selectedCategory, accessType, region, maxPrice])

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
      // Carried through so toolHref() can use it. It was being dropped here,
      // which meant every card in this grid linked to /tools/<id> and paid a
      // 308 on each click -- the exact failure docs/ROUTING.md describes under
      // "Link to tools by slug": the column is selected (it is in
      // AI_TOOLS_COLUMNS and in AIEntry) and was simply lost on the way to the
      // component. Nothing about the link looked wrong.
      slug: tool.slug,
      name: tool.name,
      description: tool.description,
      category: categoryMapping[tool.category] || tool.category,
      rating: (tool.popularity / 20).toFixed(1), // Convert popularity (0-100) to rating (0-5)
      saves: Math.floor(tool.popularity * 100), // Estimate saves from popularity
      image: tool.image || null, // Use database image URL
      platform: tool.platform,
      accessType: tool.accessType,
      pricing: tool.pricing,
      tags: tool.tags,
    }))
  }, [allTools])

  // Was recomputed (a fresh sort + fresh array) on every render of
  // ToolsContent — including re-renders triggered by unrelated state like
  // sidebarOpen or togglingFavorite — which combined with per-item motion
  // animations below caused needless list churn. Memoized on the only inputs
  // that actually change the result.
  const sortedTools = useMemo(() => {
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

    return tools.slice().sort((a, b) => {
      const aMatch = userPreferredCategories.includes(a.category)
      const bMatch = userPreferredCategories.includes(b.category)
      if (aMatch && !bMatch) return -1
      if (!aMatch && bMatch) return 1
      // Then by saves.
      //
      // There used to be a `featured` tier above this, sourced from
      // ai_tools.is_trending. That column is written by the ingest from source
      // heuristics — GitHub stars > 500/3000, HuggingFace downloads > 100k —
      // and is true for ~56,900 of 263,548 rows. Sorting a quarter of the
      // catalog to the top on that basis floated scraped repositories above
      // real products, which is the same failure documented in
      // app/api/tools/trending/route.ts. Nothing here can substantiate
      // "featured", so nothing here claims it.
      return b.saves - a.saves
    })
  }, [tools, preferences?.categories])

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
              className="fixed inset-0 glass-overlay z-30"
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
      <div className="flex flex-1 flex-col overflow-hidden pb-[var(--mobile-nav-clearance)] md:pb-0">
        {/* Header */}
        <motion.header
          className="glass-header sticky top-0 z-20"
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
          <div className="mx-auto max-w-7xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 md:px-6 md:py-8 md:pb-8 mb-[var(--mobile-nav-clearance)] md:mb-0">
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
                  // Was false, which left Enter as the only way to search on a
                  // page whose entire purpose is searching -- and nothing on
                  // screen said so.
                  showButton={true}
                  onSubmit={submitSearch}
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
                      {(accessType !== 'all' || region !== 'all' || maxPrice !== null) && (
                        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-5" align="end">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold leading-none">{t("search.filters")}</h4>
                        {(accessType !== 'all' || region !== 'all' || maxPrice !== null) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setAccessType('all')
                              setRegion('all')
                              setMaxPrice(null)
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

                      {/* Max monthly price. Runs against the parsed
                          price_monthly_min_usd column, not the free-text
                          pricing field. Free tools store 0 and so pass every
                          cap; usage-based and unpriced tools have no monthly
                          figure and are excluded rather than guessed at. */}
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-muted-foreground">{t("search.maxPrice")}</h5>
                        <div className="grid grid-cols-3 gap-2">
                          {PRICE_CAPS.map(cap => (
                            <Button
                              key={cap ?? "any"}
                              variant={maxPrice === cap ? "default" : "outline"}
                              size="sm"
                              onClick={() => setMaxPrice(cap)}
                            >
                              {cap === null ? t("search.noPriceCap") : `≤ $${cap}`}
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

              {/* Category Tabs.
                  A category arrived at via `?category=` is not always one of
                  the curated chips -- the catalog publishes 21 categories and
                  this row lists 16 -- so it is surfaced as its own chip rather
                  than leaving the list with nothing highlighted while the
                  results are silently filtered. */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                {(displayCategories.includes(selectedCategory)
                  ? displayCategories
                  : ["All", selectedCategory, ...displayCategories.slice(1)]
                ).map((category) => (
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

            {/* Arcyn's recommendation — our take first, the full directory below,
                the same hierarchy Google uses for its AI answer. This panel
                loads independently of the grid: it renders its own skeleton and
                fills in when the reasoning call returns, so the results list
                below never waits on it. */}
            {committedSearch && (
              <RecommendationPanel
                query={committedSearch}
                recommendation={recommendation}
                isLoading={isRecommendationLoading}
              />
            )}

            {/* Heading that separates our pick from the directory itself.
                Only shown when the panel above is actually present. */}
            {committedSearch && (recommendation?.bestMatch || isRecommendationLoading) && (
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  All matching tools
                </h2>
                <div className="h-px flex-1 bg-border/50" />
              </div>
            )}

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
                        // Cap the stagger so it only affects the first screenful —
                        // uncapped `index * 0.05` meant a card at position 100
                        // (easily reached via "Load more") wouldn't finish
                        // animating in for 5 full seconds after every re-render.
                        transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.05 }}
                      >
                        {/* The card used to be a <div> with an onClick that
                            opened a modal, so a search result had no URL at
                            all: nothing to copy, share, open in a new tab, or
                            link to. The title is now a real anchor stretched
                            over the card with `after:inset-0`, which keeps the
                            whole-card click target while giving the result a
                            genuine href. The modal is still reachable from the
                            Details button for a quick look. */}
                        <Card className="group relative h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-lg">
                          {/* Tool Image */}
                          <div className="relative h-40 md:h-48 overflow-hidden bg-muted">
                            <ToolImage
                              src={tool.image}
                              alt={tool.name}
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              fallbackText={tool.name}
                            />
                          </div>

                          {/* Tool Info */}
                          <div className="p-4 md:p-5">
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <h3 className="text-base md:text-lg font-semibold leading-tight">
                                <Link
                                  href={toolHref(tool)}
                                  className="after:absolute after:inset-0 after:content-[''] hover:underline"
                                >
                                  <HighlightedText text={tool.name} query={committedSearch} />
                                </Link>
                              </h3>
                              {/* Above the stretched overlay, or the anchor
                                  would swallow the click. */}
                              <div className="flex shrink-0 items-center gap-0.5">
                                <CompareToggle
                                  tool={{ id: tool.id, slug: tool.slug, name: tool.name }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="relative z-10 h-8 w-8 shrink-0 rounded-lg"
                                  onClick={(e) => handleToggleFavorite(tool.id, e)}
                                  disabled={togglingFavorite === tool.id || !user}
                                  title={favoritedTools.has(tool.id) ? t("tools.removeFromFavorites") : t("tools.addToFavorites")}
                                >
                                  <Bookmark className={`h-4 w-4 ${favoritedTools.has(tool.id) ? 'fill-primary text-primary' : ''}`} />
                                </Button>
                              </div>
                            </div>

                            <p className="mb-3 md:mb-4 line-clamp-2 text-xs md:text-sm text-muted-foreground leading-relaxed">
                              <HighlightedText text={tool.description || ''} query={committedSearch} />
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
                                className="relative z-10 gap-1"
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
            {/* `!isRecommendationLoading` matters as much as `!isLoading`.
                The list and the recommendation are separate requests and the
                recommendation is far slower -- measured at 18-33s against a
                warm server. Without it the page rendered "No tools found" the
                moment the list settled, then dropped a recommendation in above
                it half a minute later, which is what "I get zero found tools
                but somehow I get recommendations" was describing. A query that
                is still running has not found nothing; it has not finished. */}
            {!isLoading && !isRecommendationLoading && !error && filteredTools.length === 0 && (
              <motion.div className="py-12 md:py-20 mb-6 md:mb-8 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mx-auto mb-4 flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-muted">
                  <Search className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                </div>
                {/* "No tools found" directly beneath a recommendation for
                    the same query is the page contradicting itself. The list
                    and the panel are answered by different retrieval --
                    /api/ai-models for one, /api/recommend for the other -- so
                    on a long natural-language query the panel routinely finds
                    something the list does not. Say which happened. */}
                <h3 className="mb-2 text-base md:text-lg font-semibold">
                  {recommendation?.bestMatch ? t("search.noExactMatches") : t("search.noToolsFound")}
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  {recommendation?.bestMatch ? t("search.seeSuggestionAbove") : t("search.tryAdjusting")}
                </p>
              </motion.div>
            )}

            <CompareTraySpacer />
          </div>
        </main>
      </div>

      {/* The compare bar. Fixed, so it sits outside the scrolling column and
          stays reachable while the reader keeps browsing for a third tool. */}
      <CompareTray />

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
export function ToolsBrowser() {
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
