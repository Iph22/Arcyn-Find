"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Clock, ArrowUp, ArrowDown, Tag, Folder, Sparkles } from "lucide-react"
import { 
  generateSuggestions, 
  generateEnhancedSuggestions,
  getSearchHistory, 
  addToSearchHistory, 
  clearSearchHistory,
  getAutocompleteSuggestion,
  searchAIEntries,
  highlightMatches,
  getPopularSearches,
  type SearchSuggestion
} from "@/lib/search-utils"
import { useDebounce } from "@/lib/hooks"
import type { AIEntry } from "@/lib/ai-data"

interface EnhancedSearchBarProps {
  value: string
  onChange: (value: string) => void
  aiModels: AIEntry[]
  onSearch?: (query: string) => void
  onResultCountChange?: (count: number) => void
  showResultCount?: boolean
}

export function EnhancedSearchBar({ 
  value, 
  onChange, 
  aiModels, 
  onSearch,
  onResultCountChange,
  showResultCount = false
}: EnhancedSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [autocompleteText, setAutocompleteText] = useState<string>("")
  const [resultCount, setResultCount] = useState<number>(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Debounce search value for suggestions (but keep immediate input update)
  const debouncedValue = useDebounce(value, 500)
  
  // Get popular searches for empty state
  const popularSearches = useMemo(() => getPopularSearches(5), [])

  useEffect(() => {
    setHistory(getSearchHistory())
  }, [])

  // Update suggestions based on debounced value
  useEffect(() => {
    if (debouncedValue.trim() && isFocused) {
      const enhancedSuggestions = generateEnhancedSuggestions(aiModels, debouncedValue, 8)
      setSuggestions(enhancedSuggestions)
      setShowSuggestions(enhancedSuggestions.length > 0 || history.length > 0)
      
      // Calculate result count (limit to 100 for performance)
      const { results } = searchAIEntries(aiModels, debouncedValue, {}, { maxResults: 100 })
      setResultCount(results.length)
      if (onResultCountChange) {
        onResultCountChange(results.length)
      }
    } else if (isFocused && history.length > 0) {
      setSuggestions([])
      setShowSuggestions(true)
      setResultCount(aiModels.length)
      if (onResultCountChange) {
        onResultCountChange(aiModels.length)
      }
    } else {
      setShowSuggestions(false)
      setResultCount(0)
      if (onResultCountChange) {
        onResultCountChange(0)
      }
    }
    setSelectedIndex(-1)
  }, [debouncedValue, isFocused, aiModels, history.length, onResultCountChange])
  
  // Autocomplete suggestion
  useEffect(() => {
    if (value.trim() && value.length >= 2) {
      const suggestion = getAutocompleteSuggestion(value)
      setAutocompleteText(suggestion || "")
    } else {
      setAutocompleteText("")
    }
  }, [value])

  const handleInputChange = useCallback((newValue: string) => {
    onChange(newValue)
    setSelectedIndex(-1)
  }, [onChange])

  const handleSelectSuggestion = useCallback((suggestion: string | SearchSuggestion) => {
    const query = typeof suggestion === 'string' ? suggestion : suggestion.text
    onChange(query)
    addToSearchHistory(query)
    setHistory(getSearchHistory())
    setShowSuggestions(false)
    setIsFocused(false)
    inputRef.current?.blur()
    if (onSearch) {
      onSearch(query)
    }
  }, [onChange, onSearch])
  
  const handleTabAutocomplete = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && autocompleteText && !e.shiftKey) {
      e.preventDefault()
      onChange(autocompleteText)
      setAutocompleteText("")
    }
  }, [autocompleteText, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const allItems = value.trim() 
      ? suggestions.map(s => s.text)
      : [...history, ...popularSearches].slice(0, 8)

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < allItems.length) {
        const selected = value.trim() 
          ? suggestions[selectedIndex]
          : allItems[selectedIndex]
        handleSelectSuggestion(selected)
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
    } else {
      handleTabAutocomplete(e)
    }
  }, [suggestions, history, popularSearches, selectedIndex, value, handleSelectSuggestion, onSearch, handleTabAutocomplete])

  const handleClear = useCallback(() => {
    onChange("")
    inputRef.current?.focus()
  }, [onChange])

  const handleClearHistory = useCallback(() => {
    clearSearchHistory()
    setHistory([])
  }, [])

  const displayItems = useMemo(() => {
    if (value.trim()) {
      return suggestions
    }
    // Show popular searches if no history
    return history.length > 0 ? history.slice(0, 8) : popularSearches.slice(0, 8)
  }, [value, suggestions, history, popularSearches])
  
  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'tool':
        return <Sparkles className="h-4 w-4" />
      case 'tag':
        return <Tag className="h-4 w-4" />
      case 'category':
        return <Folder className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

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
            className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative">
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
              className="w-full rounded-lg border border-border bg-card px-3 sm:px-4 py-2.5 sm:py-3 pl-10 sm:pl-12 pr-8 sm:pr-10 text-base sm:text-base text-foreground placeholder-muted-foreground transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
              aria-label="Search AI tools by name or keyword"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls="search-suggestions"
            />
            {/* Autocomplete hint */}
            {autocompleteText && value.trim() && (
              <div className="absolute left-10 sm:left-12 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/50 text-sm sm:text-base">
                {autocompleteText.slice(value.length)}
              </div>
            )}
            {/* Result count */}
            {showResultCount && value.trim() && resultCount > 0 && (
              <div className="absolute right-8 sm:right-12 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs text-muted-foreground pointer-events-none">
                {resultCount} {resultCount === 1 ? 'result' : 'results'}
              </div>
            )}
          </div>
          {value && (
            <button
              onClick={handleClear}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
            className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-card shadow-lg max-h-[50vh] sm:max-h-64 overflow-y-auto"
            id="search-suggestions"
            role="listbox"
          >
            <div className="p-2">
              {value.trim() ? (
                <>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                    <span>Suggestions</span>
                    {resultCount > 0 && (
                      <span className="text-xs font-normal">{resultCount} results</span>
                    )}
                  </div>
                  {suggestions.map((suggestion, idx) => (
                    <motion.button
                      key={`${suggestion.type}-${suggestion.text}-${idx}`}
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
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getSuggestionIcon(suggestion.type)}
                        <span className="truncate" dangerouslySetInnerHTML={{
                          __html: highlightMatches(suggestion.text, value)
                        }} />
                        {suggestion.matchCount && suggestion.matchCount > 1 && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {suggestion.matchCount}
                          </span>
                        )}
                      </div>
                      {selectedIndex === idx && <ArrowUp className="h-4 w-4 ml-2 flex-shrink-0" />}
                    </motion.button>
                  ))}
                  {/* Show tool preview for first suggestion if it's a tool */}
                  {suggestions.length > 0 && suggestions[0].type === 'tool' && suggestions[0].tool && (
                    <div className="border-t border-border mt-2 pt-2 px-3">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        {suggestions[0].tool.name}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {suggestions[0].tool.description}
                      </div>
                      <div className="flex gap-1 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                          {suggestions[0].tool.category}
                        </span>
                        {suggestions[0].tool.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {history.length > 0 ? 'Recent Searches' : 'Popular Searches'}
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
                  {displayItems.map((item, idx) => (
                    <motion.button
                      key={typeof item === 'string' ? item : item.text}
                      onClick={() => handleSelectSuggestion(typeof item === 'string' ? item : item)}
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
                        {history.length > 0 ? (
                          <Clock className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {typeof item === 'string' ? item : item.text}
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

