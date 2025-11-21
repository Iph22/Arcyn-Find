"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, ExternalLink, Heart, Share2, Star, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Tool {
  id: number
  name: string
  category: string
  description: string
  image: string
  rating: number
  users: string
  tags?: string[]
}

interface ToolDetailModalProps {
  tool: Tool | null
  isOpen: boolean
  onClose: () => void
}

export function ToolDetailModal({ tool, isOpen, onClose }: ToolDetailModalProps) {
  if (!tool) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-card border border-border w-full max-w-4xl max-h-[85vh] md:max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl pointer-events-auto relative flex flex-col md:flex-row">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white/70 hover:text-white hover:bg-black/70 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Image Section */}
              <div className="w-full md:w-1/2 h-64 md:h-auto relative">
                <img src={tool.image || "/placeholder.svg"} alt={tool.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent md:bg-gradient-to-r" />
              </div>

              {/* Content Section */}
              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Badge className="bg-primary/20 text-primary border-primary/30 mb-3">{tool.category}</Badge>
                    <h2 className="text-3xl font-bold text-foreground mb-2">{tool.name}</h2>
                    <div className="flex items-center gap-2 text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="font-medium">{tool.rating}</span>
                      <span className="text-muted-foreground text-sm">({tool.users} users)</span>
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground text-lg leading-relaxed mb-6">{tool.description}</p>

                {tool.tags && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {tool.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="border-border text-muted-foreground">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-auto space-y-4">
                  <div className="flex gap-3">
                    <Button className="flex-1 h-12 text-lg">
                      Visit Website <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                    <Button variant="outline" className="h-12 w-12 p-0 bg-transparent">
                      <Heart className="w-5 h-5" />
                    </Button>
                    <Button variant="outline" className="h-12 w-12 p-0 bg-transparent">
                      <Share2 className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="p-4 rounded-xl bg-accent/50 border border-border flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    <p className="text-sm text-muted-foreground">
                      <span className="text-foreground font-medium">Pro Tip:</span> Great for{" "}
                      {tool.category.toLowerCase()} workflows.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
