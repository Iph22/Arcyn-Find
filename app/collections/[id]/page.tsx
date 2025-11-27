"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { Bookmark, Plus, Trash2, Star, ExternalLink, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/sidebar"
import { ToolCard } from "@/components/tool-card"
import { EmptyState } from "@/components/empty-state"
import { ToolCardSkeleton } from "@/components/loading-skeleton"
import { toast } from "sonner"
import type { ToolWithRating } from "@/lib/types"

export default function CollectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const collectionId = Array.isArray(params.id) ? params.id[0] : params.id || ""
  const [collection, setCollection] = useState<{
    id: string
    name: string
    description?: string | null
    is_public?: boolean
    tools_count?: number
  } | null>(null)
  const [tools, setTools] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [removingToolId, setRemovingToolId] = useState<string | null>(null)

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const response = await fetch(`/api/collections/${collectionId}`)
        if (!response.ok) throw new Error("Failed to fetch collection")
        const data = await response.json()
        setCollection(data.collection)
        setTools(
          (data.collection.collection_items?.map(
            (item: { ai_tools: ToolWithRating }) => item.ai_tools
          ) || []) as ToolWithRating[]
        )
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error("Error fetching collection:", err)
        }
      } finally {
        setIsLoading(false)
      }
    }

    if (collectionId) {
      fetchCollection()
    }
  }, [collectionId])

  const handleRemoveTool = async (toolId: string) => {
    if (!confirm('Remove this tool from the collection?')) return
    
    setRemovingToolId(toolId)
    try {
      const response = await fetch(`/api/collections/${collectionId}/tools?tool_id=${toolId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setTools(tools.filter(t => t.id !== toolId))
        toast.success('Tool removed from collection')
      } else {
        toast.error('Failed to remove tool')
      }
    } catch (error) {
      console.error('Error removing tool:', error)
      toast.error('Failed to remove tool')
    } finally {
      setRemovingToolId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
          <ToolCardSkeleton />
        </div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
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
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex-1">
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
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => router.push(`/collections/${collectionId}/edit`)}
              >
                Edit Collection
              </Button>
              <Button 
                variant="destructive" 
                onClick={async () => {
                  if (confirm('Are you sure you want to delete this collection?')) {
                    try {
                      const response = await fetch(`/api/collections/${collectionId}`, { method: 'DELETE' })
                      if (response.ok) {
                        router.push('/collections')
                      }
                    } catch (err) {
                      console.error('Error deleting collection:', err)
                    }
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {tools.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <Card key={tool.id} className="group relative h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-lg">
                  {/* Remove Button */}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2 z-10 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => handleRemoveTool(tool.id)}
                    disabled={removingToolId === tool.id}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  {/* Tool Image */}
                  <div className="relative h-48 overflow-hidden bg-muted">
                    {tool.image ? (
                      <Image
                        src={tool.image}
                        alt={tool.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary/20 to-chart-1/20 flex items-center justify-center">
                        <span className="text-4xl font-bold text-primary/50">
                          {tool.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tool Info */}
                  <div className="p-5">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold leading-tight line-clamp-1">{tool.name}</h3>
                    </div>

                    <p className="mb-4 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>

                    <div className="mb-4 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {tool.category}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {tool.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-primary text-primary" />
                            <span className="font-medium">{tool.rating}</span>
                          </div>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="gap-1"
                        onClick={() => tool.platform && window.open(tool.platform, '_blank', 'noopener,noreferrer')}
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Bookmark}
              title="No tools yet"
              description="Add tools to this collection to get started."
              action={{
                label: "Browse AI Tools",
                onClick: () => router.push("/tools")
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

