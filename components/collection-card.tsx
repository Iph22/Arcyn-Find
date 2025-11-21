"use client"

import { motion } from "framer-motion"
import { Bookmark, Lock, Globe, MoreVertical } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Collection } from "@/lib/collections"

interface CollectionCardProps {
  collection: Collection
  onSelect?: (collection: Collection) => void
  onEdit?: (collection: Collection) => void
  onDelete?: (collection: Collection) => void
  className?: string
}

export function CollectionCard({
  collection,
  onSelect,
  onEdit,
  onDelete,
  className,
}: CollectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn("h-full", className)}
    >
      <Card className="group relative h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-lg">
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Bookmark className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{collection.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {collection.is_public ? (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Globe className="h-3 w-3" />
                      Public
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Lock className="h-3 w-3" />
                      Private
                    </Badge>
                  )}
                  {collection.tool_count !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      {collection.tool_count} tools
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSelect?.(collection)}>
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit?.(collection)}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete?.(collection)}
                  className="text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {collection.description && (
            <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
              {collection.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Updated {new Date(collection.updated_at).toLocaleDateString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelect?.(collection)}
            >
              Open
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

