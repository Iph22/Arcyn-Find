"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Clock, ArrowUp, ArrowDown } from "lucide-react"
import { generateSuggestions, getSearchHistory, addToSearchHistory, clearSearchHistory } from "@/lib/search-utils"
import type { AIEntry } from "@/lib/ai-data"

interface EnhancedSearchBarProps {
  value: string
  onChange: (value: string) => void
  aiModels: AIEntry[]
  onSearch?: (query: string) => void
}

export function EnhancedSearchBar({ value, onChange, aiModels, onSearch }: EnhancedSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHistory(getSearchHistory())
  }, [])

  useEffect(() => {
    if (value.trim() && isFocused) {
      const newSuggestions = generateSuggestions(aiModels, value, 8)
      setSuggestions(newSuggestions)
      setShowSuggestions(newSuggestions.length > 0 || history.length > 0)
    } else if (isFocused && history.length > 0) {
      setSuggestions([])
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
    setSelectedIndex(-1)
  }, [value, isFocused, aiModels, history.length])

  const handleInputChange = (newValue: string) => {
    onChange(newValue)
    setSelectedIndex(-1)
  }

  const handleSelectSuggestion = (suggestion: string) => {
    onChange(suggestion)
    addToSearchHistory(suggestion)
    setHistory(getSearchHistory())
    setShowSuggestions(false)
    setIsFocused(false)
    inputRef.current?.blur()
    if (onSearch) {
      onSearch(suggestion)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allItems = [...suggestions, ...history].slice(0, 8)

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < allItems.length) {
        handleSelectSuggestion(allItems[selectedIndex])
      } else if (value.trim()) {
        addToSearchHistory(value)
        setHistory(getSearchHistory())
        if (onSearch) {
          onSearch(value)
        }
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
      setIsFocused(false)
      inputRef.current?.blur()
    }
  }

  const handleClear = () => {
    onChange("")
    inputRef.current?.focus()
  }

  const handleClearHistory = () => {
    clearSearchHistory()
    setHistory([])
  }

  const displayItems = value.trim()
    ? suggestions
    : history.slice(0, 8)

  return (
    <div ref={containerRef} className="relative w-full">
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <label htmlFor="ai-search" className="sr-only">
          Search AI tools
        </label>
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            id="ai-search"
            type="text"
            placeholder="Search by name, tags, keywords... (try: tag:api, category:vision, AND, OR)"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Delay to allow click events on suggestions
              setTimeout(() => setIsFocused(false), 200)
            }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 pl-12 pr-10 text-foreground placeholder-muted-foreground transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
            aria-label="Search AI tools by name or keyword"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls="search-suggestions"
          />
          {value && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && isFocused && displayItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-card shadow-lg max-h-[60vh] sm:max-h-64 overflow-y-auto"
            id="search-suggestions"
            role="listbox"
          >
            <div className="p-2">
              {value.trim() ? (
                <>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                    Suggestions
                  </div>
                  {suggestions.map((suggestion, idx) => (
                    <motion.button
                      key={suggestion}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                        selectedIndex === idx
                          ? "bg-accent/20 text-accent"
                          : "text-foreground hover:bg-muted"
                      }`}
                      role="option"
                      aria-selected={selectedIndex === idx}
                    >
                      <span className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        {suggestion}
                      </span>
                      {selectedIndex === idx && <ArrowUp className="h-4 w-4" />}
                    </motion.button>
                  ))}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Recent Searches
                    </div>
                    {history.length > 0 && (
                      <button
                        onClick={handleClearHistory}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {history.map((item, idx) => (
                    <motion.button
                      key={item}
                      onClick={() => handleSelectSuggestion(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                        selectedIndex === idx
                          ? "bg-accent/20 text-accent"
                          : "text-foreground hover:bg-muted"
                      }`}
                      role="option"
                      aria-selected={selectedIndex === idx}
                    >
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {item}
                      </span>
                      {selectedIndex === idx && <ArrowUp className="h-4 w-4" />}
                    </motion.button>
                  ))}
                </>
              )}
            </div>
            {value.trim() && (
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                <div className="mb-1">💡 <strong>Advanced search:</strong></div>
                <div className="space-y-0.5 text-[10px]">
                  <div>• <code>tag:api</code> - Search by tag</div>
                  <div>• <code>category:vision</code> - Filter by category</div>
                  <div>• <code>AND</code> / <code>OR</code> - Combine terms</div>
                  <div>• <code>not:paid</code> - Exclude terms</div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

