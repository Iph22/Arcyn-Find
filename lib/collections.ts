import { supabase } from './supabase'
import type { AIEntry } from './ai-data'

export interface Collection {
  id: string
  user_id: string
  name: string
  description?: string
  is_public: boolean
  created_at: string
  updated_at: string
  tool_count?: number
  user?: {
    username?: string
    display_name?: string
  }
}

export interface CollectionWithTools extends Collection {
  tools: AIEntry[]
}

/**
 * Get user's collections
 */
export async function getUserCollections(userId: string): Promise<Collection[]> {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select(`
        *,
        collection_items(count)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return (data || []).map((col: any) => ({
      ...col,
      tool_count: col.collection_items?.[0]?.count || 0,
    }))
  } catch (error) {
    console.error('Error fetching collections:', error)
    return []
  }
}

/**
 * Get public collections
 */
export async function getPublicCollections(limit: number = 20, userId?: string): Promise<Collection[]> {
  try {
    let query = supabase
      .from('collections')
      .select(`
        *,
        user_profiles:user_id (
          username,
          display_name
        ),
        collection_items(count)
      `)
      .eq('is_public', true)
    
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map((col: any) => ({
      ...col,
      tool_count: col.collection_items?.[0]?.count || 0,
      user: col.user_profiles ? {
        username: col.user_profiles.username,
        display_name: col.user_profiles.display_name,
      } : undefined,
    }))
  } catch (error) {
    console.error('Error fetching public collections:', error)
    return []
  }
}

/**
 * Get a single collection with tools
 */
export async function getCollection(collectionId: string): Promise<CollectionWithTools | null> {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select(`
        *,
        user_profiles:user_id (
          username,
          display_name
        )
      `)
      .eq('id', collectionId)
      .single()

    if (error) throw error

    // Get tools in collection
    const { data: items, error: itemsError } = await supabase
      .from('collection_items')
      .select('tool_id, notes, added_at')
      .eq('collection_id', collectionId)
      .order('added_at', { ascending: false })

    if (itemsError) throw itemsError

    // Fetch tool details from API
    const toolIds = (items || []).map(item => item.tool_id)
    const tools: AIEntry[] = []
    
    if (toolIds.length > 0) {
      const response = await fetch('/api/ai-models')
      if (response.ok) {
        const allTools = await response.json() as AIEntry[]
        tools.push(...allTools.filter(t => toolIds.includes(t.id)))
        // Sort to match collection_items order
        tools.sort((a, b) => {
          const aIdx = toolIds.indexOf(a.id)
          const bIdx = toolIds.indexOf(b.id)
          return aIdx - bIdx
        })
      }
    }

    return {
      ...data,
      user: data.user_profiles ? {
        username: data.user_profiles.username,
        display_name: data.user_profiles.display_name,
      } : undefined,
      tools,
    }
  } catch (error) {
    // Log detailed error information
    const errorDetails: Record<string, any> = {
      type: 'CollectionError',
    }
    
    try {
      if (error instanceof Error) {
        errorDetails.message = error.message
        errorDetails.name = error.name
        if (error.stack) errorDetails.stack = error.stack
      } else if (error && typeof error === 'object') {
        // Try to extract properties from error object
        const err = error as any
        // Try direct property access first
        if (err.message !== undefined) errorDetails.message = err.message
        if (err.code !== undefined) errorDetails.code = err.code
        if (err.details !== undefined) errorDetails.details = err.details
        if (err.hint !== undefined) errorDetails.hint = err.hint
        
        // If we still have nothing, try to get all properties
        if (Object.keys(errorDetails).length === 1) {
          try {
            const props = Object.getOwnPropertyNames(error)
            props.forEach(prop => {
              try {
                const value = (error as any)[prop]
                if (value !== undefined) {
                  errorDetails[prop] = value
                }
              } catch {
                // Skip non-serializable properties
              }
            })
          } catch {
            errorDetails.raw = String(error)
          }
        }
      } else {
        errorDetails.raw = String(error)
      }
    } catch (e) {
      errorDetails.fallback = String(error)
    }
    
    console.error('Error fetching collection:', errorDetails)
    return null
  }
}

/**
 * Create a new collection
 */
export async function createCollection(
  name: string,
  description?: string,
  isPublic: boolean = false
): Promise<{ success: boolean; collection?: Collection; error?: string }> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'You must be logged in to create a collection' }
    }

    const { data, error } = await supabase
      .from('collections')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        is_public: isPublic,
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, collection: data as Collection }
  } catch (error: any) {
    console.error('Error creating collection:', error)
    return { success: false, error: error.message || 'Failed to create collection' }
  }
}

/**
 * Update a collection
 */
export async function updateCollection(
  collectionId: string,
  updates: {
    name?: string
    description?: string
    is_public?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'You must be logged in' }
    }

    const { error } = await supabase
      .from('collections')
      .update(updates)
      .eq('id', collectionId)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error updating collection:', error)
    return { success: false, error: error.message || 'Failed to update collection' }
  }
}

/**
 * Delete a collection
 */
export async function deleteCollection(collectionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'You must be logged in' }
    }

    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting collection:', error)
    return { success: false, error: error.message || 'Failed to delete collection' }
  }
}

/**
 * Add tool to collection
 */
export async function addToolToCollection(
  collectionId: string,
  toolId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'You must be logged in' }
    }

    // Verify collection belongs to user
    const { data: collection } = await supabase
      .from('collections')
      .select('id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single()

    if (!collection) {
      return { success: false, error: 'Collection not found or access denied' }
    }

    const { error } = await supabase
      .from('collection_items')
      .insert({
        collection_id: collectionId,
        tool_id: toolId,
        notes: notes || null,
      })

    if (error) {
      if (error.code === '23505') { // Unique constraint
        return { success: false, error: 'Tool is already in this collection' }
      }
      throw error
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error adding tool to collection:', error)
    return { success: false, error: error.message || 'Failed to add tool' }
  }
}

/**
 * Remove tool from collection
 */
export async function removeToolFromCollection(
  collectionId: string,
  toolId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'You must be logged in' }
    }

    // Verify collection belongs to user
    const { data: collection } = await supabase
      .from('collections')
      .select('id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single()

    if (!collection) {
      return { success: false, error: 'Collection not found or access denied' }
    }

    const { error } = await supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('tool_id', toolId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error removing tool from collection:', error)
    return { success: false, error: error.message || 'Failed to remove tool' }
  }
}

