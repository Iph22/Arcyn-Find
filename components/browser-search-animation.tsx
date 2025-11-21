"use client"

import { motion } from "framer-motion"
import { Search, ArrowRight, Star, Command } from "lucide-react"
import { useState, useEffect } from "react"

export function BrowserSearchAnimation() {
  const [query, setQuery] = useState("")
  const fullQuery = "best AI tools for developers"
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
    <div className="w-full h-full flex items-center justify-center p-4 sm:p-8 lg:p-12">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-3xl aspect-[16/10] bg-[#1E1E2E] rounded-xl shadow-2xl border border-white/10 overflow-hidden flex flex-col"
      >
        {/* Browser Toolbar */}
        <div className="h-10 bg-[#252535] border-b border-white/5 flex items-center px-4 gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-[#1E1E2E] rounded-md px-3 py-1 text-xs text-white/40 flex items-center gap-2 w-64 justify-center">
              <Search className="w-3 h-3" />
              arcyn-find.com
            </div>
          </div>
        </div>

        {/* Browser Content */}
        <div className="flex-1 bg-[#1E1E2E] p-8 flex flex-col relative overflow-hidden">
          {/* Search Bar Area */}
          <motion.div
            animate={{ y: showResults ? -40 : 0, scale: showResults ? 0.9 : 1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="flex flex-col items-center justify-center mt-12 sm:mt-20"
          >
            <div className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Command className="w-5 h-5 text-white" />
              </div>
              Arcyn Find
            </div>
            <div className="w-full max-w-lg relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={query}
                readOnly
                className="w-full bg-[#252535] border border-white/10 rounded-full py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <motion.div
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY }}
                  className="w-0.5 h-5 bg-blue-500"
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
              className="mt-8 grid gap-4 max-w-2xl mx-auto w-full"
            >
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                  className="bg-[#252535] border border-white/5 rounded-lg p-4 hover:bg-[#2A2A3A] transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          i === 1
                            ? "bg-blue-500/20 text-blue-400"
                            : i === 2
                              ? "bg-purple-500/20 text-purple-400"
                              : "bg-green-500/20 text-green-400"
                        }`}
                      >
                        <Star className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors">
                          {i === 1 ? "DevAssistant Pro" : i === 2 ? "CodeGenius AI" : "DebugMaster 3000"}
                        </h3>
                        <p className="text-white/40 text-sm mt-1">
                          The ultimate AI tool for developers to streamline workflow...
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
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
