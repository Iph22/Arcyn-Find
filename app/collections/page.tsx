"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { BookOpen, Globe, Lock, Users, Loader2, Search } from "lucide-react"
import { getPublicCollections, type Collection } from "@/lib/collections"
import Link from "next/link"

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadCollections()
  }, [])

  async function loadCollections() {
    try {
      setLoading(true)
      const data = await getPublicCollections(100)
      setCollections(data)
    } catch (error) {
      console.error("Error loading collections:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCollections = collections.filter((collection) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      collection.name.toLowerCase().includes(query) ||
      collection.description?.toLowerCase().includes(query) ||
      collection.user?.username?.toLowerCase().includes(query) ||
      collection.user?.display_name?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-6 w-6 text-accent" />
            <h1 className="text-3xl font-bold">Public Collections</h1>
          </div>
          <p className="text-muted-foreground">
            Discover curated collections of AI tools created by the community
          </p>
        </motion.div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {searchQuery ? "No Collections Found" : "No Public Collections Yet"}
            </h2>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Try a different search term"
                : "Be the first to create a public collection!"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCollections.map((collection, idx) => (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  href={`/collections/${collection.id}`}
                  className="block rounded-xl border border-border bg-card p-6 hover:border-accent/50 transition-colors h-full"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1 truncate">
                        {collection.name}
                      </h3>
                      {collection.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {collection.description}
                        </p>
                      )}
                    </div>
                    {collection.is_public ? (
                      <Globe className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                    ) : (
                      <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span>{collection.tool_count || 0} tools</span>
                      {collection.user && (
                        <span className="truncate">
                          by {collection.user.display_name || collection.user.username || "Anonymous"}
                        </span>
                      )}
                    </div>
                    {collection.created_at && (
                      <span className="text-xs">
                        {new Date(collection.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

