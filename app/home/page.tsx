"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Sparkles, TrendingUp, Menu, X, Star } from "lucide-react"
import { PremiumSearchInput } from "@/components/search/premium-search-input"
import { AISuggestions } from "@/components/search/ai-suggestions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sidebar } from "@/components/layout/sidebar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { LanguagePicker } from "@/components/layout/language-picker"
import { PricingBadge } from "@/components/tools/pricing-badge"
import { usePreferences } from "@/contexts/preferences-context"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"
import { logger } from "@/lib/logger"
import { categoryPageHref, searchHref, toolHref } from "@/lib/tool-href"
import { categoriesForInterests } from "@/lib/interest-categories"
import { addRecentSearch, getRecentSearches } from "@/lib/recent-searches"
import { toast } from "sonner"

/** A category that has a public page. Mirrors /api/categories. */
interface PublicCategory {
  slug: string
  name: string
  count: number
}

interface TrendingTool {
  id: string
  slug?: string | null
  name: string
  category: string
  rating: number
  users: string
  image: string | null
  description: string
  tags: string[]
  access_type: string
  pricing: string | null
  review_count: number
  favorites_count: number
}

export default function HomePage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false) // Hidden by default on mobile
  const { preferences, isLoading } = usePreferences()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const [trendingTools, setTrendingTools] = useState<TrendingTool[]>([])
  const [loadingTrending, setLoadingTrending] = useState(true)
  // The categories that actually have a page. Needed before any category can
  // be linked: /tools/category/[slug] notFound()s below MIN_CATEGORY_SIZE, so
  // slugifying a tool's category string and hoping is a 404 generator.
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const categorySlugs = new Set(categories.map((c) => c.slug))

  // Read on mount rather than in the initial state, because localStorage does
  // not exist during SSR and touching it in a useState initialiser would make
  // the first client render disagree with the server's.
  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/")
      return
    }
    if (isAuthenticated) {
      loadTrendingTools()
      loadCategories()

      // Ensure profile exists and is up-to-date with username/display_name
      fetch('/api/auth/ensure-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch(err => {
        logger.error('Error ensuring profile:', err)
        // Silent failure - not critical for page functionality
      })
    }
    // Keyed on user?.id, not the whole `user` object — a new object identity
    // from useAuth/usePreferences context re-renders (same user) was refiring
    // this effect (and re-fetching trending tools + re-hitting ensure-profile)
    // more than once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, isAuthenticated, router])

  const loadTrendingTools = async () => {
    try {
      setLoadingTrending(true)
      const category = preferences?.categories?.[0] || 'all'
      const response = await fetch(`/api/tools/trending?limit=6&category=${category}`)

      if (!response.ok) {
        throw new Error(`Failed to load trending tools: ${response.statusText}`)
      }

      const data = await response.json()
      setTrendingTools(data.tools || [])
    } catch (error) {
      logger.error('Error loading trending tools:', error)
      toast.error('Failed to load trending tools. Please try again later.')
      setTrendingTools([]) // Reset to empty array on error
    } finally {
      setLoadingTrending(false)
    }
  }

  // Failure here is deliberately quiet: no category list means the category
  // panel renders nothing and trending rows drop their category link. That is
  // a smaller loss than a toast on a page the user did not ask anything of.
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (!response.ok) return
      const data = await response.json()
      setCategories(Array.isArray(data.categories) ? data.categories : [])
    } catch (error) {
      logger.error('Error loading categories:', error)
    }
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    )
  }

  const getRoleBasedGreeting = () => {
    const name = preferences?.userName || "Explorer"
    switch (preferences?.userRole) {
      case "developer":
        return `Ready to code, ${name}?`
      case "student":
        return `Time to learn, ${name}?`
      case "designer":
        return `Let's create, ${name}!`
      case "business":
        return `Let's grow, ${name}!`
      default:
        return `Welcome back, ${name}`
    }
  }

  const getRecommendedCategory = () => {
    switch (preferences?.userRole) {
      case "developer":
        return "Coding Tools"
      case "student":
        return "Study Aids"
      case "designer":
        return "Design Assets"
      default:
        return "Trending Now"
    }
  }

  /**
   * Run a search.
   *
   * Both of these used to push `/tools?search=...`. /tools is the static SEO
   * directory -- its page function takes no searchParams at all -- so the
   * query was dropped on every search from this page and the user landed on a
   * generic category grid with no sign that anything had been searched. The
   * component that reads `?search=` is ToolsBrowser, mounted at /browse.
   */
  const runSearch = (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setRecentSearches(addRecentSearch(trimmed))
    router.push(searchHref(trimmed))
  }

  const handleSearchSubmit = () => runSearch(searchQuery)

  return (
    <div className="flex h-dvh bg-background">
      {/* Sidebar */}
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
            {/* Sidebar - Show as drawer on mobile, fixed on desktop */}
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-40 h-full w-72"
            >
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col w-full pb-[var(--mobile-nav-clearance)] md:pb-0 overflow-y-auto">
        {/* Header */}
        <motion.header
          className="glass-header sticky top-0 z-20 pt-[env(safe-area-inset-top)]"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="h-10 w-10 touch-manipulation"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold truncate">Arcyn Find</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-accent/50 border border-border">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-muted-foreground">{preferences?.level || "Explorer"} level</span>
              </div>
              <LanguagePicker />
              <ThemeToggle />
            </div>
          </div>
        </motion.header>

        {/* Search Section */}
        <main className="flex-1">
          <section className="flex flex-col justify-center">
            <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
              {/* Hero Search */}
              <motion.div
                className="mb-8 sm:mb-12 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h1 className="mb-4 text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-balance flex flex-col items-center gap-2">
                  <span>{getRoleBasedGreeting()}</span>
                  <span className="bg-gradient-to-r from-primary via-chart-1 to-chart-3 bg-clip-text text-transparent">
                    {preferences?.userRole
                      ? `${preferences.userRole.charAt(0).toUpperCase() + preferences.userRole.slice(1)} Mode`
                      : "Explore AI"}
                  </span>
                </h1>
                <p className="mx-auto mb-6 sm:mb-8 max-w-2xl text-base sm:text-lg text-muted-foreground text-balance px-2">
                  {preferences?.purpose === "work"
                    ? "Find professional AI tools to boost your productivity"
                    : preferences?.purpose === "building"
                      ? "Discover AI tools to build your next big thing"
                      : preferences?.purpose === "research"
                        ? "Explore AI tools for advanced research and analysis"
                        : "Discover AI tools worldwide"}
                </p>

                {/* Search Bar */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400 }}
                  className="mx-auto max-w-3xl"
                >
                  <PremiumSearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSubmit={handleSearchSubmit}
                    placeholder={t("search.placeholder")}
                    showButton={true}
                    onFocus={() => {
                      // Handle mobile scroll
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        setTimeout(() => {
                          const element = document.activeElement
                          element?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                            inline: 'nearest'
                          })
                        }, 100)
                      }
                    }}
                  />
                </motion.div>
              </motion.div>

              {/* Category shortcuts.
                  The heading tells the truth about where these came from: the
                  user's onboarding interests when those resolve to real
                  categories, otherwise the largest ones. It does not claim to
                  be personalised when it is not. */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-8"
              >
                {(() => {
                  const interestCategories = categoriesForInterests(preferences?.categories, categories)
                  const usingInterests = interestCategories.length > 0
                  return (
                    <AISuggestions
                      categories={usingInterests ? interestCategories : categories}
                      heading={usingInterests ? t("home.yourInterests") : t("home.browseByCategory")}
                      subheading={
                        usingInterests
                          ? t("home.basedOnInterests")
                          : t("home.biggestCategories")
                      }
                      limit={6}
                    />
                  )
                })()}
              </motion.div>

              {/* Quick Access Cards */}
              <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
                {/* Trending Searches */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Card className="h-full overflow-hidden border-border/50 bg-card/50 p-4 md:p-6 backdrop-blur-sm transition-all hover:border-border hover:shadow-md">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <h2 className="text-lg font-semibold">{getRecommendedCategory()}</h2>
                      </div>
                    </div>

                    <div className="space-y-3 md:space-y-4">
                      {loadingTrending ? (
                        <div className="flex justify-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                        </div>
                      ) : trendingTools.length === 0 ? (
                        <p className="text-center py-8 text-sm text-muted-foreground">{t("home.noTrending")}</p>
                      ) : (
                        trendingTools.slice(0, 3).map((tool) => (
                          // A real row, not a click handler. The whole row is
                          // still clickable -- the title anchor is stretched
                          // over it with `after:inset-0` -- but it is one <a>
                          // with an href, so it can be opened in a new tab,
                          // copied, and prefetched. The category link sits
                          // above that overlay on its own z-index.
                          <motion.div
                            key={tool.id}
                            className="group relative flex items-center gap-3 md:gap-4 p-2 rounded-xl hover:bg-accent/50 transition-colors touch-manipulation"
                            whileHover={{ x: 4 }}
                          >
                            {tool.image ? (
                              <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden shrink-0">
                                <Image
                                  src={tool.image}
                                  alt={tool.name}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 768px) 40px, 48px"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-br from-primary/20 to-chart-1/20 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate">
                                <Link
                                  href={toolHref(tool)}
                                  className="after:absolute after:inset-0 after:content-[''] hover:underline"
                                >
                                  {tool.name}
                                </Link>
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                {(() => {
                                  const href = categoryPageHref(tool.category, categorySlugs)
                                  // Opens the browser filtered to this
                                  // category. Categories too small to be
                                  // published stay plain text.
                                  return href ? (
                                    <Link
                                      href={href}
                                      className="relative z-10 text-xs text-muted-foreground truncate hover:text-foreground hover:underline"
                                    >
                                      {tool.category}
                                    </Link>
                                  ) : (
                                    <p className="text-xs text-muted-foreground truncate">{tool.category}</p>
                                  )
                                })()}
                                <PricingBadge
                                  pricing={tool.pricing}
                                  accessType={tool.access_type}
                                  size="sm"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-yellow-400 text-xs shrink-0">
                              <Star className="w-3 h-3 fill-current" />
                              {tool.rating > 0 ? tool.rating.toFixed(1) : 'New'}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </Card>
                </motion.div>

                {/* Recent Searches */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  <Card className="h-full overflow-hidden border-border/50 bg-card/50 p-4 md:p-6 backdrop-blur-sm transition-all hover:border-border hover:shadow-md">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-1/10">
                        <Search className="h-5 w-5 text-chart-1" />
                      </div>
                      <h2 className="text-lg font-semibold">{t("home.recentSearches")}</h2>
                    </div>
                    {/* This panel shows the reader's own searches or nothing.
                        It previously showed three hardcoded strings under a
                        "Recent Searches" heading, which is not a placeholder
                        -- it is a claim about the reader that is false. An
                        empty panel on a first visit is the honest state. */}
                    <div className="space-y-2">
                      {recentSearches.length === 0 && (
                        <p className="px-1 py-6 text-sm text-muted-foreground">
                          {t("home.noRecentSearches")}
                        </p>
                      )}
                      {recentSearches.map((search) => (
                        <motion.div key={search} whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400 }}>
                          {/* A link, so the search is reachable by middle-click
                              and back/forward. The old handler only called
                              setSearchQuery() -- it filled the input and never
                              submitted, so clicking one appeared to do nothing. */}
                          <Link
                            href={searchHref(search)}
                            onClick={() => setRecentSearches(addRecentSearch(search))}
                            className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-accent touch-manipulation"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                              <Search className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium truncate">{search}</span>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              </div>
            </div>
          </section>

        </main>
      </div>

    </div>
  )
}
