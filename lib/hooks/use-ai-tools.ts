"use client"

import { useState, useEffect, useCallback } from "react"
import type { AIEntry } from "@/lib/ai-data"

interface UseAIToolsOptions {
  category?: string
  region?: string
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
}

export function useAITools(options: UseAIToolsOptions = {}): UseAIToolsReturn {
  const { category, region, searchQuery, limit = 50, offset = 0, enabled = true } = options
  const [tools, setTools] = useState<AIEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const fetchTools = useCallback(async () => {
    if (!enabled) return

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (category) params.append("category", category)
      if (region) params.append("region", region)
      if (searchQuery) params.append("search", searchQuery)
      if (limit) params.append("limit", limit.toString())
      if (offset) params.append("offset", offset.toString())

      const response = await fetch(`/api/ai-models?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`)
      }

      const data = await response.json()
      setTools(Array.isArray(data) ? data : [])
      setHasMore(Array.isArray(data) && data.length === limit)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch AI tools"
      setError(errorMessage)
      console.error("Error fetching AI tools:", err)
      setTools([])
    } finally {
      setIsLoading(false)
    }
  }, [category, region, searchQuery, limit, enabled])

  useEffect(() => {
    fetchTools()
  }, [fetchTools])

  return {
    tools,
    isLoading,
    error,
    refetch: fetchTools,
    hasMore,
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

    setIsLoading(true)
    setError(null)

    fetch(`/api/ai-models?id=${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch tool")
        return res.json()
      })
      .then((data) => {
        const toolData = Array.isArray(data.tools) ? data.tools[0] : data.tool || data
        setTool(toolData)
      })
      .catch((err) => {
        setError(err.message)
        console.error("Error fetching tool:", err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [id])

  return { tool, isLoading, error }
}

