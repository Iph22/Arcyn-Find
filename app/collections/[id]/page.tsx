"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Bookmark, Plus, Trash2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/sidebar"
import { ToolCard } from "@/components/tool-card"
import { EmptyState } from "@/components/empty-state"
import { ToolCardSkeleton } from "@/components/loading-skeleton"

export default function CollectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const collectionId = Array.isArray(params.id) ? params.id[0] : params.id || ""
  const [collection, setCollection] = useState<any>(null)
  const [tools, setTools] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const response = await fetch(`/api/collections/${collectionId}`)
        if (!response.ok) throw new Error("Failed to fetch collection")
        const data = await response.json()
        setCollection(data.collection)
        setTools(data.collection.collection_items?.map((item: any) => item.ai_tools) || [])
      } catch (err) {
        console.error("Error fetching collection:", err)
      } finally {
        setIsLoading(false)
      }
    }

    if (collectionId) {
      fetchCollection()
    }
  }, [collectionId])

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">
          <ToolCardSkeleton />
        </div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">
          <EmptyState
            icon={Bookmark}
            title="Collection not found"
            description="This collection doesn't exist or has been removed."
            action={{
              label: "Go Back",
              onClick: () => router.push("/collections"),
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-6">
            <h1 className="mb-2 text-3xl font-bold">{collection.name}</h1>
            {collection.description && (
              <p className="text-muted-foreground">{collection.description}</p>
            )}
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="outline">
                {tools.length} {tools.length === 1 ? "tool" : "tools"}
              </Badge>
              {collection.is_public ? (
                <Badge variant="secondary">Public</Badge>
              ) : (
                <Badge variant="secondary">Private</Badge>
              )}
            </div>
          </div>

          {tools.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Bookmark}
              title="No tools yet"
              description="Add tools to this collection to get started."
            />
          )}
        </div>
      </div>
    </div>
  )
}

