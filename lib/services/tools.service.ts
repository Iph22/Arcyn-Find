import { getSupabaseAdmin, transformToAIEntry } from '@/lib/supabase'
import type { AIEntry } from '@/lib/ai-data'

/**
 * Tools Service
 * Handles all business logic for AI tools
 */
export class ToolsService {
  /**
   * Build base query with filters
   */
  static buildBaseQuery(filters: {
    category?: string
    region?: string
    accessType?: string
    search?: string
  }) {
    const supabase = getSupabaseAdmin()
    let queryBuilder = supabase.from('ai_tools').select('*', { count: 'exact' })

    if (filters.category) {
      let decodedCategory = filters.category
      try {
        if (filters.category.includes('%')) {
          decodedCategory = decodeURIComponent(filters.category).trim()
        } else {
          decodedCategory = filters.category.trim()
        }
      } catch {
        decodedCategory = filters.category.trim()
      }
      queryBuilder = queryBuilder.ilike('category', decodedCategory)
    }

    if (filters.region) {
      let decodedRegion = filters.region
      try {
        if (filters.region.includes('%')) {
          decodedRegion = decodeURIComponent(filters.region).trim()
        } else {
          decodedRegion = filters.region.trim()
        }
      } catch {
        decodedRegion = filters.region.trim()
      }
      queryBuilder = queryBuilder.ilike('region', decodedRegion)
    }

    if (filters.accessType) {
      let decodedAccessType = filters.accessType
      try {
        if (filters.accessType.includes('%')) {
          decodedAccessType = decodeURIComponent(filters.accessType).trim()
        } else {
          decodedAccessType = filters.accessType.trim()
        }
      } catch {
        decodedAccessType = filters.accessType.trim()
      }
      queryBuilder = queryBuilder.ilike('access_type', decodedAccessType)
    }

    if (filters.search) {
      // Escape special characters in search term
      const escapedSearch = filters.search.replace(/%/g, '\\%').replace(/_/g, '\\_')

      // For multi-word queries, search for each word individually
      const searchWords = escapedSearch.trim().split(/\s+/).filter((w) => w.length > 0)

      if (searchWords.length > 1) {
        // Multi-word query: search for each word in name, description, or platform
        const conditions: string[] = []
        searchWords.forEach((word) => {
          conditions.push(`name.ilike.%${word}%`)
          conditions.push(`description.ilike.%${word}%`)
          conditions.push(`platform.ilike.%${word}%`)
        })
        queryBuilder = queryBuilder.or(conditions.join(','))
      } else {
        // Single word query
        queryBuilder = queryBuilder.or(
          `name.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%,platform.ilike.%${escapedSearch}%`
        )
      }
    }

    return queryBuilder
  }

  /**
   * Get tools with pagination and filters
   */
  static async getTools(options: {
    limit?: number
    offset?: number
    category?: string
    region?: string
    accessType?: string
    search?: string
  }): Promise<{ tools: AIEntry[]; total: number }> {
    const limit = options.limit || 50
    const offset = options.offset || 0

    const queryBuilder = this.buildBaseQuery({
      category: options.category,
      region: options.region,
      accessType: options.accessType,
      search: options.search,
    })

    const { data, error, count } = await queryBuilder
      .order('popularity', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist
        return { tools: [], total: 0 }
      }
      throw error
    }

    const tools = (data || []).map((row) => transformToAIEntry(row))

    return {
      tools,
      total: count || 0,
    }
  }

  /**
   * Get a single tool by ID
   */
  static async getToolById(toolId: string): Promise<AIEntry | null> {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('ai_tools')
      .select('*')
      .eq('id', toolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      if (error.code === '42P01') {
        return null
      }
      throw error
    }

    return transformToAIEntry(data)
  }

  /**
   * Update tool popularity
   */
  static async updatePopularity(toolId: string, popularityIncrease: number = 0.1) {
    const supabase = getSupabaseAdmin()

    // Get current tool data
    const { data: tool, error: fetchError } = await supabase
      .from('ai_tools')
      .select('popularity, name')
      .eq('id', toolId)
      .single()

    if (fetchError || !tool) {
      throw new Error('Tool not found')
    }

    // Calculate new popularity
    const currentPopularity = tool.popularity || 50
    let newPopularity = Math.min(100, currentPopularity + popularityIncrease)

    // If popularity is already high, increase more slowly
    if (currentPopularity > 80) {
      newPopularity = Math.min(100, currentPopularity + popularityIncrease * 0.5)
    }

    // Update popularity in database
    const { error: updateError } = await supabase
      .from('ai_tools')
      .update({
        popularity: Math.round(newPopularity),
        updated_at: new Date().toISOString(),
      })
      .eq('id', toolId)

    if (updateError) throw updateError

    return Math.round(newPopularity)
  }
}

