"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Menu, X, Plus, MoreVertical, Lock, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { getCurrentUser } from "@/lib/auth"

const collections = [
  {
    id: 1,
    name: "AI Writing Essentials",
    description: "My go-to tools for content creation and writing assistance",
    tools: 12,
    isPublic: true,
    color: "primary",
    thumbnail: "/placeholder.svg?key=col1",
  },
  {
    id: 2,
    name: "Image Generation Masters",
    description: "Best AI tools for creating stunning visuals and artwork",
    tools: 8,
    isPublic: true,
    color: "chart-1",
    thumbnail: "/placeholder.svg?key=col2",
  },
  {
    id: 3,
    name: "Developer Tools",
    description: "Coding assistants and development utilities I use daily",
    tools: 15,
    isPublic: false,
    color: "chart-2",
    thumbnail: "/placeholder.svg?key=col3",
  },
  {
    id: 4,
    name: "Data & Analytics",
    description: "Tools for data analysis, visualization, and insights",
    tools: 6,
    isPublic: true,
    color: "chart-3",
    thumbnail: "/placeholder.svg?key=col4",
  },
]

export default function CollectionsPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative z-20"
          >
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
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
                
                <span className="text-lg font-bold">Collections</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Collection
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </motion.header>

        {/* Collections Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-8">
            {/* Page Title */}
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h1 className="mb-2 text-4xl font-bold">My Collections</h1>
              <p className="text-lg text-muted-foreground">Organize your favorite AI tools into custom collections</p>
            </motion.div>

            {/* Collections Grid */}
            <motion.div
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {collections.map((collection, index) => (
                <motion.div
                  key={collection.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  whileHover={{ y: -5 }}
                >
                  <Card className="group relative h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-lg">
                    {/* Collection Thumbnail */}
                    <div
                      className={`relative h-40 bg-gradient-to-br from-${collection.color}/20 via-${collection.color}/10 to-transparent`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className={`h-12 w-12 text-${collection.color} opacity-50`} />
                      </div>

                      {/* Actions */}
                      <div className="absolute right-3 top-3 flex gap-2">
                        <Badge variant="secondary" className="gap-1 text-xs backdrop-blur-sm">
                          {collection.isPublic ? (
                            <>
                              <Globe className="h-3 w-3" />
                              Public
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" />
                              Private
                            </>
                          )}
                        </Badge>
                        <Button variant="secondary" size="icon" className="h-8 w-8 backdrop-blur-sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Collection Info */}
                    <div className="p-5">
                      <h3 className="mb-2 text-lg font-semibold leading-tight">{collection.name}</h3>
                      <p className="mb-4 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                        {collection.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{collection.tools} tools</span>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </div>
                    </div>

                    {/* Hover Overlay */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-br from-${collection.color}/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100`}
                    />
                  </Card>
                </motion.div>
              ))}

              {/* Create New Collection Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: collections.length * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="flex h-full min-h-[280px] cursor-pointer items-center justify-center border-2 border-dashed border-border/50 bg-card/30 backdrop-blur-sm transition-all hover:border-border hover:bg-card/50">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                      <Plus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mb-2 font-semibold">Create Collection</h3>
                    <p className="text-sm text-muted-foreground">Start a new collection</p>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}
