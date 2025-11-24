import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Favorites Service
 * Handles all business logic for favorites
 */
export class FavoritesService {
  /**
   * Get all favorite tool IDs for a user
   */
  static async getUserFavorites(userId: string): Promise<string[]> {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('user_favorites')
      .select('tool_id')
      .eq('user_id', userId)

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist - return empty array
        return []
      }
      throw error
    }

    return (data || []).map((item) => item.tool_id)
  }

  /**
   * Add a tool to favorites
   */
  static async addFavorite(userId: string, toolId: string) {
    const supabase = getSupabaseAdmin()

    const { error } = await supabase.from('user_favorites').insert({
      user_id: userId,
      tool_id: toolId,
    })

    if (error) {
      if (error.code === '23505') {
        throw new Error('Already favorited')
      }
      if (error.code === '42P01') {
        throw new Error('Favorites table does not exist')
      }
      throw error
    }
  }

  /**
   * Remove a tool from favorites
   */
  static async removeFavorite(userId: string, toolId: string) {
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('tool_id', toolId)

    if (error) {
      if (error.code === '42P01') {
        throw new Error('Favorites table does not exist')
      }
      throw error
    }
  }

  /**
   * Check if a tool is favorited by a user
   */
  static async isFavorited(userId: string, toolId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('tool_id', toolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - not favorited
        return false
      }
      if (error.code === '42P01') {
        // Table doesn't exist
        return false
      }
      throw error
    }

    return !!data
  }
}

