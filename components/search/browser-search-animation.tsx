"use client"

import { motion } from "framer-motion"
import { Search, ArrowRight, Command } from "lucide-react"
import { useState, useEffect } from "react"
import type { LandingSearchDemo } from "@/lib/landing/search-demo"

/** Tile colours, cycled by position. Deliberately not derived from the tool —
 *  a stable per-index palette keeps the three rows visually distinct without
 *  implying the colour means something. */
const TILE_STYLES = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-blue-500/20",
  "bg-purple-500/15 text-purple-600 dark:text-purple-400 ring-purple-500/20",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
]

/**
 * Initials for the tile. The catalog's `image` is unusable here: a large share
 * of rows carry `/og-image.png`, this site's own social card, so three results
 * would show the same picture three times.
 */
function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

const TYPING_MS = 70

/**
 * The homepage hero's mock browser.
 *
 * Non-interactive by design — it is a picture of the product, not the product.
 * The query and results arrive from the server (lib/landing/search-demo.ts) so
 * that what it shows is what the real search returns.
 */
export function BrowserSearchAnimation({ demo }: { demo: LandingSearchDemo }) {
  const { query: fullQuery, results } = demo
  const [typed, setTyped] = useState("")
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    setTyped("")
    setShowResults(false)

    let index = 0
    let revealTimer: ReturnType<typeof setTimeout> | undefined

    const typing = setInterval(() => {
      index++
      setTyped(fullQuery.slice(0, index))
      if (index >= fullQuery.length) {
        clearInterval(typing)
        revealTimer = setTimeout(() => setShowResults(true), 400)
      }
    }, TYPING_MS)

    return () => {
      clearInterval(typing)
      if (revealTimer) clearTimeout(revealTimer)
    }
  }, [fullQuery])

  return (
    <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        aria-hidden="true"
        className="w-full max-w-5xl aspect-[16/10] bg-card border-2 border-border rounded-xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-sm"
      >
        {/* Browser Toolbar */}
        <div className="h-10 sm:h-12 bg-muted/50 border-b border-border flex items-center px-3 sm:px-4 gap-2 flex-shrink-0">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-background/50 rounded-md px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2 max-w-xs w-full justify-center border border-border/50">
              <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
              <span className="truncate">arcynfind.com</span>
            </div>
          </div>
        </div>

        {/* Browser Content */}
        <div className="flex-1 bg-background/30 px-3 py-4 sm:p-6 lg:p-8 flex flex-col min-h-0">
          <motion.div
            animate={{ y: showResults ? -8 : 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="flex flex-col items-center justify-center flex-shrink-0"
          >
            <div className="text-base sm:text-xl lg:text-2xl font-bold text-foreground mb-3 sm:mb-5 flex items-center gap-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg">
                <Command className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <span>Arcyn Find</span>
            </div>

            <div className="w-full max-w-lg relative">
              <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              {/* A div, not a readonly input: this is decoration, and an input
                  here put an unlabelled, unreachable form control in the tab
                  order on every homepage visit. */}
              <div className="w-full bg-card border-2 border-border rounded-full py-2.5 sm:py-3.5 pl-10 sm:pl-12 pr-10 text-foreground shadow-lg text-xs sm:text-base min-h-[2.75rem] sm:min-h-[3.5rem] flex items-center">
                <span className="truncate">{typed}</span>
                <motion.span
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, times: [0, 0.5, 0.5, 1] }}
                  className="inline-block w-[2px] h-4 sm:h-5 bg-primary ml-0.5 flex-shrink-0"
                />
              </div>
            </div>
          </motion.div>

          {/* Results */}
          {showResults && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="mt-3 sm:mt-5 grid gap-2 sm:gap-2.5 max-w-2xl mx-auto w-full min-h-0"
            >
              {results.map((tool, i) => (
                <motion.div
                  key={tool.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.12 }}
                  className="bg-card border border-border rounded-lg p-2.5 sm:p-3.5 flex items-start gap-2.5 sm:gap-3"
                >
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ring-1 flex items-center justify-center flex-shrink-0 text-[11px] sm:text-sm font-bold ${
                      TILE_STYLES[i % TILE_STYLES.length]
                    }`}
                  >
                    {initials(tool.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground font-semibold text-xs sm:text-sm truncate">{tool.name}</h3>
                      {tool.accessType && (
                        <span className="text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                          {tool.accessType}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-[10px] sm:text-xs mt-0.5 line-clamp-2 leading-snug">
                      {tool.description}
                    </p>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0 mt-1" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
