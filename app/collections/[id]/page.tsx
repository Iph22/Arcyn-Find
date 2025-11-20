"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, ExternalLink, Trash2, Folder, Globe, Lock } from "lucide-react"
import { getCollection, removeToolFromCollection, type CollectionWithTools } from "@/lib/collections"
import { getCurrentUser } from "@/lib/auth"
import { AICard } from "@/components/ai-card"
import Link from "next/link"

export default function CollectionPage() {
  const params = useParams()
  const router = useRouter()
  const [collection, setCollection] = useState<CollectionWithTools | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [params.id])

  const loadData = async () => {
    setLoading(true)
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      const collectionId = params.id as string
      const collectionData = await getCollection(collectionId)
      setCollection(collectionData)
    } catch (error) {
      console.error('Error loading collection:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTool = async (toolId: string) => {
    if (!collection) return
    if (!confirm('Remove this tool from the collection?')) return

    const result = await removeToolFromCollection(collection.id, toolId)
    if (result.success) {
      await loadData()
    } else {
      alert(result.error || 'Failed to remove tool')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Collection Not Found</h1>
          <p className="text-muted-foreground mb-4">This collection doesn't exist or is private.</p>
          <button
            onClick={() => router.push('/')}
            className="rounded-lg bg-accent px-4 py-2 text-accent-foreground"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  const isOwner = user?.id === collection.user_id

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Folder className="h-6 w-6 text-accent" />
                <h1 className="text-3xl font-bold">{collection.name}</h1>
                {collection.is_public ? (
                  <Globe className="h-5 w-5 text-muted-foreground" aria-label="Public" />
                ) : (
                  <Lock className="h-5 w-5 text-muted-foreground" aria-label="Private" />
                )}
              </div>
              {collection.description && (
                <p className="text-muted-foreground mb-2">{collection.description}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {collection.tools.length} {collection.tools.length === 1 ? 'tool' : 'tools'}
                {collection.user && (
                  <> • By {collection.user.display_name || collection.user.username || 'Unknown'}</>
                )}
              </p>
            </div>
          </div>
        </motion.div>

        {collection.tools.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card p-12 text-center">
            <Folder className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">This collection is empty</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {collection.tools.map((tool, idx) => (
              <div key={tool.id} className="relative group">
                <AICard
                  ai={tool}
                  onClick={() => router.push(`/ai/${tool.id}`)}
                  delay={idx * 0.05}
                />
                {isOwner && (
                  <button
                    onClick={() => handleRemoveTool(tool.id)}
                    className="absolute top-2 right-2 z-20 rounded-lg bg-background/90 backdrop-blur-md p-2 shadow-lg border border-border/50 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from collection"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

