"use client"

import { motion } from "framer-motion"
import { Search, ArrowRight, Star, Command } from "lucide-react"
import { useState, useEffect } from "react"

export function BrowserSearchAnimation() {
  const [query, setQuery] = useState("")
  const fullQuery = "Find and filter the best AI tools for developers"
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    let currentIndex = 0
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullQuery.length) {
        setQuery(fullQuery.slice(0, currentIndex))
        currentIndex++
      } else {
        clearInterval(typingInterval)
        setTimeout(() => setShowResults(true), 500)
      }
    }, 100)

    return () => clearInterval(typingInterval)
  }, [])

  return (
    <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-5xl aspect-[16/10] bg-card border-2 border-border rounded-xl shadow-2xl overflow-visible flex flex-col backdrop-blur-sm"
      >
        {/* Browser Toolbar */}
        <div className="h-12 bg-muted/50 border-b border-border flex items-center px-4 gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-background/50 rounded-md px-4 py-1.5 text-xs text-muted-foreground flex items-center gap-2 max-w-xs w-full justify-center border border-border/50">
              <Search className="w-3.5 h-3.5" />
              <span className="truncate">arcyn-find.com</span>
            </div>
          </div>
        </div>

        {/* Browser Content */}
        <div className="flex-1 bg-background/30 p-4 sm:p-6 lg:p-8 flex flex-col relative overflow-visible">
          {/* Search Bar Area */}
          <motion.div
            animate={{ y: showResults ? -20 : 0, scale: showResults ? 0.98 : 1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="flex flex-col items-center justify-center mt-4 sm:mt-6 lg:mt-8"
          >
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground mb-4 sm:mb-6 flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg">
                <Command className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <span>Arcyn Find</span>
            </div>
            <div className="w-full max-w-lg relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={query}
                readOnly
                className="w-full bg-card border-2 border-border rounded-full py-3 sm:py-3.5 pl-12 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-lg text-sm sm:text-base"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <motion.div
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY }}
                  className="w-0.5 h-5 bg-primary"
                />
              </div>
            </div>
          </motion.div>

          {/* Results Area */}
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-4 sm:mt-6 grid gap-2 sm:gap-3 max-w-2xl mx-auto w-full px-2 pb-2"
            >
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                  className="bg-card border-2 border-border rounded-lg p-4 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          i === 1
                            ? "bg-blue-500/20 text-blue-500 dark:text-blue-400"
                            : i === 2
                              ? "bg-purple-500/20 text-purple-500 dark:text-purple-400"
                              : "bg-green-500/20 text-green-500 dark:text-green-400"
                        }`}
                      >
                        <Star className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-foreground font-semibold group-hover:text-primary transition-colors text-sm sm:text-base truncate">
                          {i === 1 ? "DevAssistant Pro" : i === 2 ? "CodeGenius AI" : "DebugMaster 3000"}
                        </h3>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-1 line-clamp-2">
                          The ultimate AI tool for developers to streamline workflow...
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
