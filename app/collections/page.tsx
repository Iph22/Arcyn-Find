"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Menu, X, Plus, MoreVertical, Lock, Globe, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useUser } from "@clerk/nextjs"
import { toast } from "sonner"

interface Collection {
  id: string
  name: string
  description: string | null
  is_public: boolean
  tools_count: number
  created_at: string
  updated_at: string
}

export default function CollectionsPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/")
      return
    }
    if (user) {
      loadCollections()
    }
  }, [user, isLoaded, router])

  const loadCollections = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/user/collections')
      if (response.ok) {
        const data = await response.json()
        setCollections(data.collections || [])
      }
    } catch (error) {
      console.error('Error loading collections:', error)
      toast.error('Failed to load collections')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isLoaded) {
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
              <Button className="gap-2" onClick={() => router.push('/collections/new')}>
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
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : collections.length === 0 ? (
              <Card className="border-border/50 bg-card/50 p-12 text-center backdrop-blur-sm">
                <Bookmark className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                <h3 className="mb-2 text-2xl font-semibold">No collections yet</h3>
                <p className="mb-6 text-muted-foreground">Create your first collection to organize your favorite AI tools</p>
                <Button className="gap-2" onClick={() => router.push('/collections/new')}>
                  <Plus className="h-4 w-4" />
                  Create Collection
                </Button>
              </Card>
            ) : (
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
                    <Card 
                      className="group relative h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-lg cursor-pointer"
                      onClick={() => router.push(`/collections/${collection.id}`)}
                    >
                      {/* Collection Thumbnail */}
                      <div className="relative h-40 bg-gradient-to-br from-primary/20 via-chart-1/10 to-transparent">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Bookmark className="h-12 w-12 text-primary opacity-50" />
                        </div>

                        {/* Actions */}
                        <div className="absolute right-3 top-3 flex gap-2">
                          <Badge variant="secondary" className="gap-1 text-xs backdrop-blur-sm">
                            {collection.is_public ? (
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
                          <Button 
                            variant="secondary" 
                            size="icon" 
                            className="h-8 w-8 backdrop-blur-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/collections/${collection.id}/edit`)
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Collection Info */}
                      <div className="p-5">
                        <h3 className="mb-2 text-lg font-semibold leading-tight">{collection.name}</h3>
                        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                          {collection.description || 'No description provided'}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{collection.tools_count} tools</span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/collections/${collection.id}`)
                            }}
                          >
                            View
                          </Button>
                        </div>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
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
                  <Card 
                    className="flex h-full min-h-[280px] cursor-pointer items-center justify-center border-2 border-dashed border-border/50 bg-card/30 backdrop-blur-sm transition-all hover:border-border hover:bg-card/50"
                    onClick={() => router.push('/collections/new')}
                  >
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
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
