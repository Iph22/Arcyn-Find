"use client"

import { useState, useEffect, useCallback } from "react"
// Auth handled by API routes
// Supabase calls replaced with API routes

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFavorites = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/favorites')
      
      if (!response.ok) {
        if (response.status === 401) {
          setFavorites([])
          return
        }
        throw new Error('Failed to fetch favorites')
      }

      const data = await response.json()
      // FavoritesService returns string[] (tool IDs), not objects
      setFavorites(Array.isArray(data.favorites) ? data.favorites : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch favorites")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addFavorite = useCallback(async (toolId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId }),
      })

      if (!response.ok) {
        throw new Error('Failed to add favorite')
      }

      setFavorites((prev) => [...prev, toolId])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add favorite"
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const removeFavorite = useCallback(async (toolId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/favorites/${toolId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove favorite')
      }

      setFavorites((prev) => prev.filter((id) => id !== toolId))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to remove favorite"
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const toggleFavorite = useCallback(
    async (toolId: string) => {
      if (favorites.includes(toolId)) {
        await removeFavorite(toolId)
      } else {
        await addFavorite(toolId)
      }
    },
    [favorites, addFavorite, removeFavorite]
  )

  const isFavorite = useCallback(
    (toolId: string) => favorites.includes(toolId),
    [favorites]
  )

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  return {
    favorites,
    isLoading,
    error,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
  }
}

