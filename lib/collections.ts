import { getSupabaseAdmin, transformToAIEntry, AI_TOOLS_COLUMNS } from './supabase'
import type { AIEntry } from './ai-data'
import { getCurrentUser } from '@/lib/google-auth'

/**
 * Server-side database access, via the SERVICE ROLE key.
 *
 * This module used the ANON client, and it is imported only by server code
 * (no "use client" component imports it -- collection-card.tsx takes a type,
 * which is erased). Writing through the anon key meant the anon role needed
 * INSERT/UPDATE/DELETE on these tables, and because that key ships in the
 * public client bundle, anyone holding it had those rights directly.
 *
 * Measured on the new project 2026-09-28, before this change: anon held
 * DELETE, INSERT, SELECT, UPDATE and TRUNCATE on all 19 public tables, with
 * RLS off on 17 of them. Moving these calls to the service role is what lets
 * those grants be revoked -- see supabase/bootstrap/05_rls_and_grants.sql.
 *
 * Lazy rather than module-scope: getSupabaseAdmin() throws when the service
 * role key is absent, and this module is imported by 21 API routes. Failing
 * on first use beats failing at import time across all of them.
 */
let _admin: ReturnType<typeof getSupabaseAdmin> | null = null
const db = () => (_admin ??= getSupabaseAdmin())


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
    const { data, error } = await db()
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
    let query = db()
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
    const { data, error } = await db()
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
    const { data: items, error: itemsError } = await db()
      .from('collection_items')
      .select('tool_id, notes, added_at')
      .eq('collection_id', collectionId)
      .order('added_at', { ascending: false })

    if (itemsError) throw itemsError

    // Fetch exactly the tools this collection holds.
    //
    // This used to `fetch('/api/ai-models')` with no parameters -- 500 tool
    // rows over HTTP -- and then filter that list down to the handful of ids
    // below. A direct `.in()` asks for the rows we actually want, and drops a
    // second bug on the way: a relative fetch() has no origin to resolve
    // against on the server, so this function only ever worked in the browser.
    const toolIds = (items || []).map(item => item.tool_id)
    let tools: AIEntry[] = []

    if (toolIds.length > 0) {
      const { data: toolRows, error: toolsError } = await db()
        .from('ai_tools')
        .select(AI_TOOLS_COLUMNS)
        .in('id', toolIds)

      if (toolsError) throw toolsError

      // PostgREST returns `.in()` results in its own order, so restore the
      // collection's ordering (added_at DESC) from the ids we asked for.
      const position = new Map(toolIds.map((id, index) => [id, index]))
      tools = (toolRows || [])
        .map(transformToAIEntry)
        .sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))
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
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'You must be logged in to create a collection' }
    }

    const { data, error } = await db()
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
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'You must be logged in' }
    }

    const { error } = await db()
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
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'You must be logged in' }
    }

    const { error } = await db()
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
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'You must be logged in' }
    }

    // Verify collection belongs to user
    const { data: collection } = await db()
      .from('collections')
      .select('id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single()

    if (!collection) {
      return { success: false, error: 'Collection not found or access denied' }
    }

    const { error } = await db()
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
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'You must be logged in' }
    }

    // Verify collection belongs to user
    const { data: collection } = await db()
      .from('collections')
      .select('id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single()

    if (!collection) {
      return { success: false, error: 'Collection not found or access denied' }
    }

    const { error } = await db()
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

