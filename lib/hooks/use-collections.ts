"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getUserCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addToolToCollection,
  removeToolFromCollection,
  type Collection,
} from "@/lib/collections"

// Auth handled by API routes

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCollections = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Auth handled by API route
      const response = await fetch('/api/collections')
      if (!response.ok) {
        throw new Error('Failed to fetch collections')
      }
      const data = await response.json()
      setCollections(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch collections")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const create = useCallback(
    async (name: string, description?: string, isPublic = false) => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, is_public: isPublic }),
        })
        
        if (!response.ok) {
          throw new Error('Failed to create collection')
        }
        
        const result = await response.json()
        if (!result.success || !result.collection) {
          throw new Error(result.error || "Failed to create collection")
        }
        setCollections((prev) => [result.collection!, ...prev])
        return result.collection
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create collection"
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const update = useCallback(
    async (id: string, updates: Partial<Collection>) => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await updateCollection(id, {
          name: updates.name,
          description: updates.description,
          is_public: updates.is_public,
        })
        if (!result.success) {
          throw new Error(result.error || "Failed to update collection")
        }
        await fetchCollections()
        const updated = collections.find((col) => col.id === id)
        return updated!
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update collection"
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const remove = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await deleteCollection(id)
      setCollections((prev) => prev.filter((col) => col.id !== id))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete collection"
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addTool = useCallback(async (collectionId: string, toolId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await addToolToCollection(collectionId, toolId)
      await fetchCollections()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add tool"
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [fetchCollections])

  const removeTool = useCallback(async (collectionId: string, toolId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await removeToolFromCollection(collectionId, toolId)
      await fetchCollections()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to remove tool"
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [fetchCollections])

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  return {
    collections,
    isLoading,
    error,
    fetchCollections,
    create,
    update,
    remove,
    addTool,
    removeTool,
  }
}

