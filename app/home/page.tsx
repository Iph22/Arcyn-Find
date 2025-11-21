"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Sparkles, TrendingUp, Menu, X, Star } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { ToolDetailModal } from "@/components/tool-detail-modal"
import { usePreferences } from "@/contexts/preferences-context"
import { getCurrentUser } from "@/lib/auth"

// Mock Data with more details
const trendingTools = [
  {
    id: 1,
    name: "Midjourney",
    category: "Image Generation",
    rating: 4.9,
    users: "2M+",
    image: "/digital-art-creation.png",
    description:
      "Create stunning visuals with the most advanced AI art generator. Perfect for designers and artists looking to explore new creative horizons.",
    tags: ["Art", "Design", "Creative"],
  },
  {
    id: 2,
    name: "ChatGPT Plus",
    category: "Assistant",
    rating: 4.8,
    users: "100M+",
    image: "/ai-assistant-interface.png",
    description: "The industry standard for AI conversation. Use it for coding, writing, analysis, and much more.",
    tags: ["Chat", "Productivity", "Writing"],
  },
  {
    id: 3,
    name: "GitHub Copilot",
    category: "Coding",
    rating: 4.9,
    users: "1M+",
    image: "/code-editor-interface.png",
    description:
      "Your AI pair programmer. Speeds up development by suggesting whole lines or entire functions right inside your editor.",
    tags: ["Dev", "Code", "Productivity"],
  },
]

export default function HomePage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { preferences, isLoading } = usePreferences()
  const [selectedTool, setSelectedTool] = useState<any>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (!user) {
          router.push("/")
          return
        }
      } catch (error) {
        console.error("Auth check error:", error)
        router.push("/")
      } finally {
        setIsAuthLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
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

  const getPersonalizedTrending = () => {
    const categoryMap: Record<string, string[]> = {
      text: ["GPT-4 Alternatives", "AI Writing Assistants"],
      vision: ["Image Generation Tools", "Video AI Tools"],
      coding: ["Code Assistants", "GitHub Copilot Alternatives"],
      agents: ["AI Agents Platforms", "Autonomous AI Tools"],
      automation: ["Workflow Automation", "No-Code AI Tools"],
      knowledge: ["Knowledge Management AI", "Research Tools"],
      research: ["Academic AI Tools", "Data Analysis AI"],
      productivity: ["Productivity AI", "Task Management Tools"],
    }

    const purposeMap: Record<string, string> = {
      exploring: "Popular AI Tools",
      work: "Business AI Tools",
      building: "Developer AI Tools",
      research: "Research AI Tools",
      personal: "Personal AI Tools",
    }

    if (preferences?.categories && preferences.categories.length > 0) {
      const userCategories = preferences.categories
      const suggestions: Array<{ query: string; category: string }> = []

      userCategories.forEach((cat) => {
        const queries = categoryMap[cat] || []
        queries.forEach((query) => {
          suggestions.push({ query, category: cat.charAt(0).toUpperCase() + cat.slice(1) })
        })
      })

      if (preferences.purpose) {
        const purposeQuery = purposeMap[preferences.purpose] || "Trending AI Tools"
        suggestions.unshift({ query: purposeQuery, category: "Recommended" })
      }

      return suggestions.slice(0, 4)
    }

    return [
      { query: "GPT-4 Alternatives", category: "AI Models" },
      { query: "Image Generation Tools", category: "Creative" },
      { query: "Code Assistants", category: "Development" },
      { query: "Data Analysis AI", category: "Analytics" },
    ]
  }

  const trendingSearches = getPersonalizedTrending()

  return (
    <div className="flex h-screen overflow-hidden bg-background snap-y snap-mandatory">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <>
            {/* Added mobile overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
            />
            {/* Made sidebar fixed on mobile and relative on desktop for better responsiveness */}
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-40 h-full w-3/4 max-w-xs md:relative md:z-20 md:w-auto"
            >
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden w-full">
        {/* Header */}
        <motion.header
          className="border-b border-border/40 bg-card/50 backdrop-blur-xl"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-10 w-10">
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
              <ThemeToggle />
            </div>
          </div>
        </motion.header>

        {/* Search Section */}
        <main className="flex-1 overflow-y-auto snap-y snap-mandatory">
          <section className="min-h-screen snap-start snap-always flex flex-col justify-center">
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
                <motion.div whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400 }}>
                  <Card className="mx-auto max-w-3xl overflow-hidden border-border/50 bg-card/50 p-2 shadow-lg backdrop-blur-sm">
                    <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-12 sm:h-14 border-0 bg-transparent pl-10 sm:pl-12 text-base focus-visible:ring-0"
                        />
                      </div>
                      <Button size="lg" className="h-12 sm:h-14 px-4 sm:px-8 font-semibold shadow-sm">
                        <span className="hidden sm:inline">Search</span>
                        <Search className="sm:hidden w-5 h-5" />
                      </Button>
                    </form>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Quick Access Cards */}
              <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
                {/* Trending Searches */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Card className="h-full overflow-hidden border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-border hover:shadow-md">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <h2 className="text-lg font-semibold">{getRecommendedCategory()}</h2>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {trendingTools.map((tool) => (
                        <motion.div
                          key={tool.id}
                          onClick={() => setSelectedTool(tool)}
                          className="flex items-center gap-4 p-2 rounded-xl hover:bg-accent/50 cursor-pointer transition-colors"
                          whileHover={{ x: 4 }}
                        >
                          <img
                            src={tool.image || "/placeholder.svg"}
                            alt={tool.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                          <div className="flex-1">
                            <h3 className="font-medium">{tool.name}</h3>
                            <p className="text-xs text-muted-foreground">{tool.category}</p>
                          </div>
                          <div className="flex items-center gap-1 text-yellow-400 text-xs">
                            <Star className="w-3 h-3 fill-current" />
                            {tool.rating}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </motion.div>

                {/* Recent Searches */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  <Card className="h-full overflow-hidden border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-border hover:shadow-md">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-1/10">
                        <Search className="h-5 w-5 text-chart-1" />
                      </div>
                      <h2 className="text-lg font-semibold">Recent Searches</h2>
                    </div>
                    <div className="space-y-2">
                      {["ChatGPT Plugins", "Midjourney Prompts", "AI Writing Tools"].map((search, index) => (
                        <motion.button
                          key={index}
                          onClick={() => setSearchQuery(search)}
                          className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-accent"
                          whileHover={{ x: 4 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                            <Search className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="text-sm font-medium">{search}</span>
                        </motion.button>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              </div>
            </div>
          </section>

          <section className="min-h-screen snap-start snap-always">
            <div className="mx-auto max-w-5xl px-6 py-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <h2 className="mb-6 text-2xl font-bold">
                  {preferences?.categories?.length ? "Your Interests" : "Popular Categories"}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {(preferences?.categories?.length
                    ? preferences.categories.map((cat) => ({
                        name: cat.charAt(0).toUpperCase() + cat.slice(1),
                        count: Math.floor(Math.random() * 100) + 50,
                        color: "primary",
                        id: cat,
                      }))
                    : [
                        { name: "AI Writing", count: 124, color: "primary", id: "text" },
                        { name: "Image Generation", count: 89, color: "chart-1", id: "vision" },
                        { name: "Code Assistants", count: 67, color: "chart-2", id: "coding" },
                        { name: "Data Analysis", count: 53, color: "chart-3", id: "research" },
                      ]
                  ).map((category, index) => (
                    <motion.button
                      key={category.id}
                      className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 p-6 text-left backdrop-blur-sm transition-all hover:border-border hover:shadow-md"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      <div className="relative z-10">
                        <h3 className="mb-1 font-semibold">{category.name}</h3>
                        <p className="text-sm text-muted-foreground">{category.count} tools</p>
                      </div>
                      <div
                        className={`absolute inset-0 bg-gradient-to-br from-${category.color}/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100`}
                      />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>
        </main>
      </div>

      <ToolDetailModal tool={selectedTool} isOpen={!!selectedTool} onClose={() => setSelectedTool(null)} />
    </div>
  )
}
