"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAITools } from "./use-ai-tools"
import { safeLocalStorage } from "@/lib/client-utils"

interface SearchHistoryItem {
  query: string
  timestamp: number
}

export function useSearch() {
  const [query, setQuery] = useState("")
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  const { tools, isLoading, error, refetch } = useAITools({
    searchQuery: query,
    enabled: false,
  })

  // Load search history from localStorage
  useEffect(() => {
    const stored = safeLocalStorage.getItem("arcyn-search-history")
    if (stored) {
      try {
        setSearchHistory(JSON.parse(stored))
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to parse search history:", err)
      }
    }
  }, [])

  // Save search history to localStorage
  useEffect(() => {
    if (searchHistory.length > 0) {
      safeLocalStorage.setItem("arcyn-search-history", JSON.stringify(searchHistory))
    }
  }, [searchHistory])

  // Generate suggestions from history
  useEffect(() => {
    if (query.length > 0) {
      const matching = searchHistory
        .filter((item) =>
          item.query.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5)
        .map((item) => item.query)
      setSuggestions(matching)
    } else {
      setSuggestions([])
    }
  }, [query, searchHistory])

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) return

      // Add to history
      setSearchHistory((prev) => {
        const filtered = prev.filter((item) => item.query !== searchQuery)
        return [
          { query: searchQuery, timestamp: Date.now() },
          ...filtered,
        ].slice(0, 10) // Keep last 10 searches
      })

      setQuery(searchQuery)
      await refetch()
    },
    [refetch]
  )

  const debouncedSearch = useCallback(
    (searchQuery: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }

      debounceTimer.current = setTimeout(() => {
        performSearch(searchQuery)
      }, 300) as unknown as NodeJS.Timeout
    },
    [performSearch]
  )

  const clearHistory = useCallback(() => {
    setSearchHistory([])
    safeLocalStorage.removeItem("arcyn-search-history")
  }, [])

  return {
    query,
    setQuery,
    tools,
    isLoading,
    error,
    suggestions,
    searchHistory,
    performSearch,
    debouncedSearch,
    clearHistory,
  }
}

