import { getSupabaseAdmin } from '@/lib/supabase'
import type { CollectionWithCount } from '@/lib/types'

/**
 * Collections Service
 * Handles all business logic for collections
 */
export class CollectionsService {
  /**
   * Get all collections for a user
   */
  static async getUserCollections(userId: string): Promise<CollectionWithCount[]> {
    const supabase = getSupabaseAdmin()
    
    const { data, error } = await supabase
      .from('collections')
      .select(
        `
        *,
        collection_items(count)
      `
      )
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist - return empty array
        return []
      }
      throw error
    }

    return (data || []).map((col) => ({
      ...col,
      tool_count: col.collection_items?.[0]?.count || 0,
    }))
  }

  /**
   * Create a new collection
   */
  static async createCollection(
    userId: string,
    data: { name: string; description?: string; is_public?: boolean }
  ) {
    const supabase = getSupabaseAdmin()
    
    const { data: collection, error } = await supabase
      .from('collections')
      .insert({
        user_id: userId,
        name: data.name,
        description: data.description,
        is_public: data.is_public ?? false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') {
        throw new Error('Collections table does not exist')
      }
      throw error
    }

    return collection
  }

  /**
   * Get a collection by ID
   */
  static async getCollectionById(collectionId: string) {
    const supabase = getSupabaseAdmin()
    
    const { data, error } = await supabase
      .from('collections')
      .select(
        `
        *,
        collection_items(
          tool_id,
          ai_tools(*)
        )
      `
      )
      .eq('id', collectionId)
      .single()

    if (error) {
      if (error.code === '42P01') {
        throw new Error('Collection not found')
      }
      if (error.code === 'PGRST116') {
        throw new Error('Collection not found')
      }
      throw error
    }

    return data
  }

  /**
   * Update a collection
   */
  static async updateCollection(
    collectionId: string,
    updates: { name?: string; description?: string; is_public?: boolean }
  ) {
    const supabase = getSupabaseAdmin()
    
    const { data, error } = await supabase
      .from('collections')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', collectionId)
      .select()
      .single()

    if (error) throw error

    return data
  }

  /**
   * Delete a collection
   */
  static async deleteCollection(collectionId: string) {
    const supabase = getSupabaseAdmin()
    
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)

    if (error) throw error
  }

  /**
   * Verify collection ownership
   */
  static async verifyOwnership(collectionId: string, userId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin()
    
    const { data, error } = await supabase
      .from('collections')
      .select('user_id')
      .eq('id', collectionId)
      .single()

    if (error || !data) return false

    return data.user_id === userId
  }

  /**
   * Add tool to collection
   */
  static async addToolToCollection(collectionId: string, toolId: string) {
    const supabase = getSupabaseAdmin()
    
    const { error } = await supabase
      .from('collection_items')
      .insert({
        collection_id: collectionId,
        tool_id: toolId,
      })

    if (error) {
      if (error.code === '23505') {
        throw new Error('Tool already in collection')
      }
      throw error
    }
  }

  /**
   * Remove tool from collection
   */
  static async removeToolFromCollection(collectionId: string, toolId: string) {
    const supabase = getSupabaseAdmin()
    
    const { error } = await supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('tool_id', toolId)

    if (error) throw error
  }
}

