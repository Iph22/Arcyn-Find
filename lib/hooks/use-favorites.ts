"use client"

import { useState, useEffect, useCallback } from "react"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFavorites = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const user = await getCurrentUser()
      if (!user) {
        setFavorites([])
        return
      }

      const { data, error: fetchError } = await supabase
        .from("favorites")
        .select("tool_id")
        .eq("user_id", user.id)

      if (fetchError) throw fetchError
      setFavorites((data || []).map((item) => item.tool_id))
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
      const user = await getCurrentUser()
      if (!user) {
        throw new Error("Not authenticated")
      }

      const { error: insertError } = await supabase
        .from("favorites")
        .insert({ user_id: user.id, tool_id: toolId })

      if (insertError) throw insertError
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
      const user = await getCurrentUser()
      if (!user) {
        throw new Error("Not authenticated")
      }

      const { error: deleteError } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("tool_id", toolId)

      if (deleteError) throw deleteError
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

