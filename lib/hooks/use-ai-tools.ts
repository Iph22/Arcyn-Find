"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { AIEntry } from "@/lib/ai-data"

interface UseAIToolsOptions {
  category?: string
  region?: string
  accessType?: string
  searchQuery?: string
  limit?: number
  offset?: number
  enabled?: boolean
}

interface UseAIToolsReturn {
  tools: AIEntry[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  hasMore: boolean
  isCached: boolean // NEW: tells the UI if we're showing cached data
}

/**
 * Client-side search result cache.
 * Stores recent API results so repeated searches are INSTANT.
 * Uses a simple LRU-like Map with max 50 entries.
 */
const clientCache = new Map<string, { data: AIEntry[], timestamp: number }>()
const CLIENT_CACHE_TTL = 1000 * 60 * 3 // 3 minutes
const CLIENT_CACHE_MAX = 50

function getCacheKey(options: UseAIToolsOptions): string {
  return JSON.stringify({
    c: options.category || '',
    r: options.region || '',
    a: options.accessType || '',
    q: options.searchQuery || '',
    l: options.limit || 50,
    o: options.offset || 0,
  })
}

function setCache(key: string, data: AIEntry[]) {
  // LRU eviction
  if (clientCache.size >= CLIENT_CACHE_MAX) {
    const oldest = clientCache.keys().next().value
    if (oldest) clientCache.delete(oldest)
  }
  clientCache.set(key, { data, timestamp: Date.now() })
}

function getCache(key: string): AIEntry[] | null {
  const entry = clientCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CLIENT_CACHE_TTL) {
    clientCache.delete(key)
    return null
  }
  return entry.data
}

export function useAITools(options: UseAIToolsOptions = {}): UseAIToolsReturn {
  const { category, region, accessType, searchQuery, limit = 50, offset = 0, enabled = true } = options
  const [tools, setTools] = useState<AIEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isCached, setIsCached] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Reset tools when filters change
  useEffect(() => {
    setTools([])
    setHasMore(true)
  }, [category, region, accessType, searchQuery])

  const fetchTools = useCallback(async () => {
    if (!enabled) return

    const cacheKey = getCacheKey({ category, region, accessType, searchQuery, limit, offset })

    // 1. Check client cache first — show immediately (stale-while-revalidate)
    const cached = getCache(cacheKey)
    if (cached) {
      setTools(cached)
      setIsCached(true)
      setHasMore(cached.length === limit)
      // Still fetch fresh data in background
    } else {
      setIsCached(false)
    }

    // 2. Abort any in-flight request (race condition prevention)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (category) params.append("category", category)
      if (region) params.append("region", region)
      if (accessType) params.append("accessType", accessType)
      if (searchQuery) params.append("search", searchQuery)
      if (limit) params.append("limit", limit.toString())
      if (offset) params.append("offset", offset.toString())

      const response = await fetch(`/api/ai-models?${params.toString()}`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`)
      }

      const data = await response.json()
      const toolsArray = Array.isArray(data) ? data : []

      // Only update if this request wasn't aborted
      if (!controller.signal.aborted) {
        setTools(toolsArray)
        setHasMore(toolsArray.length === limit)
        setIsCached(false)

        // Cache the result for future use
        setCache(cacheKey, toolsArray)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Request was aborted — do nothing
        return
      }
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch AI tools"
      // Don't show error if we have cached data
      if (!cached) {
        setError(errorMessage)
        setTools([])
      }
      setHasMore(false)
      console.error("Error fetching AI tools:", err)
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [category, region, accessType, searchQuery, limit, offset, enabled])

  useEffect(() => {
    fetchTools()
    return () => {
      // Cleanup: abort on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchTools])

  return {
    tools,
    isLoading,
    error,
    refetch: fetchTools,
    hasMore,
    isCached,
  }
}

// Hook for fetching trending tools
export function useTrendingTools(limit: number = 10) {
  return useAITools({
    limit,
    enabled: true,
  })
}

// Hook for fetching a single tool by ID
export function useAITool(id: string | null) {
  const [tool, setTool] = useState<AIEntry | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setTool(null)
      return
    }

    let isMounted = true

    setIsLoading(true)
    setError(null)

    fetch(`/api/ai-models?id=${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch tool")
        return res.json()
      })
      .then((data) => {
        // API returns an array when fetching by ID
        const toolData = Array.isArray(data) ? data[0] : null
        if (isMounted) {
          setTool(toolData)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message)
          console.error("Error fetching tool:", err)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [id])

  return { tool, isLoading, error }
}
