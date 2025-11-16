"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, ExternalLink } from "lucide-react"
import type { AIEntry } from "@/lib/ai-data"

interface ComparisonModalProps {
  isOpen: boolean
  onClose: () => void
  tools: AIEntry[]
}

export function ComparisonModal({ isOpen, onClose, tools }: ComparisonModalProps) {
  if (tools.length === 0) return null

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
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-6xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Compare AI Tools</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-2 hover:bg-muted transition-colors"
                aria-label="Close comparison"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 text-left font-semibold">Feature</th>
                    {tools.map((tool) => (
                      <th key={tool.id} className="p-4 text-left font-semibold">
                        {tool.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="p-4 font-medium">Category</td>
                    {tools.map((tool) => (
                      <td key={tool.id} className="p-4">{tool.category}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-4 font-medium">Description</td>
                    {tools.map((tool) => (
                      <td key={tool.id} className="p-4 text-sm text-muted-foreground">{tool.description}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-4 font-medium">Access Type</td>
                    {tools.map((tool) => (
                      <td key={tool.id} className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          tool.accessType === 'Free' ? 'bg-green-500/20 text-green-400' :
                          tool.accessType === 'Freemium' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {tool.accessType}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-4 font-medium">Pricing</td>
                    {tools.map((tool) => (
                      <td key={tool.id} className="p-4">{tool.pricing}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-4 font-medium">Region</td>
                    {tools.map((tool) => (
                      <td key={tool.id} className="p-4">{tool.region}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-4 font-medium">Popularity</td>
                    {tools.map((tool) => (
                      <td key={tool.id} className="p-4">{tool.popularity}%</td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-4 font-medium">Tags</td>
                    {tools.map((tool) => (
                      <td key={tool.id} className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {tool.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">Platform</td>
                    {tools.map((tool) => (
                      <td key={tool.id} className="p-4">
                        <a
                          href={tool.platform}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-accent hover:underline"
                        >
                          Visit <ExternalLink className="h-4 w-4" />
                        </a>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

