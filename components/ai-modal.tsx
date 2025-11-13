"use client"

import type React from "react"

import { motion, AnimatePresence } from "framer-motion"
import { X, ExternalLink, Copy, Check } from "lucide-react"
import type { AIEntry } from "@/lib/ai-data"
import { useState, useEffect } from "react"

interface AIModalProps {
  ai: AIEntry | null
  isOpen: boolean
  onClose: () => void
}

export function AIModal({ ai, isOpen, onClose }: AIModalProps) {
  const [copied, setCopied] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  const handleCopy = () => {
    navigator.clipboard.writeText(ai.platform)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getAccessTypeColor = (type: string) => {
    switch (type) {
      case "Free":
        return "bg-green-500/20 text-green-400"
      case "Freemium":
        return "bg-blue-500/20 text-blue-400"
      case "Paid":
        return "bg-purple-500/20 text-purple-400"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolling(true)
    setTimeout(() => setIsScrolling(false), 1500)
  }

  if (!ai) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div
              onScroll={handleScroll}
              className={`relative w-full max-w-2xl rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto ${
                isScrolling ? "scroll-animate" : ""
              }`}
            >
              <button
                onClick={onClose}
                className="sticky top-4 right-4 float-right rounded-lg p-2 hover:bg-muted transition-colors z-10"
              >
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </button>

              <div className="p-8 pt-0">
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex-1">
                    <h2 className="mb-2 text-3xl font-bold text-foreground">{ai.name}</h2>
                    <p className="text-lg text-accent">{ai.category}</p>
                  </div>
                </div>

                <p className="mb-6 text-base text-muted-foreground leading-relaxed">{ai.description}</p>

                <div className="grid gap-4 md:grid-cols-2 mb-6">
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Access Type</p>
                    <p className={`text-lg font-bold rounded-lg w-fit px-3 py-1 ${getAccessTypeColor(ai.accessType)}`}>
                      {ai.accessType}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Pricing</p>
                    <p className="text-lg font-bold text-foreground">{ai.pricing}</p>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Region</p>
                    <p className="text-lg font-bold text-foreground">{ai.region}</p>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Popularity</p>
                    <p className="text-lg font-bold text-accent">{ai.popularity}%</p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="mb-3 text-sm font-semibold text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {ai.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-6 rounded-lg border border-border/50 bg-muted/30 p-4">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Platform Link</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ai.platform}
                      readOnly
                      className="flex-1 rounded-lg bg-background px-3 py-2 text-sm text-foreground truncate"
                    />
                    <button
                      onClick={handleCopy}
                      className="rounded-lg bg-accent/20 p-2 hover:bg-accent/40 transition-colors"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-accent" />}
                    </button>
                  </div>
                </div>

                <p className="mb-4 text-xs text-muted-foreground">
                  Last updated: {new Date(ai.lastUpdated).toLocaleDateString()}
                </p>

                <div className="flex gap-3">
                  <a
                    href={ai.platform}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-lg bg-accent px-4 py-3 font-medium text-accent-foreground transition-all hover:shadow-lg hover:shadow-accent/50 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit Platform
                  </a>
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-border bg-card px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
