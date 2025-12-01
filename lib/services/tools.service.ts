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
      
      // Special handling for Marketing, Design, IDEs, and AI Coding Agents - also search by tags
      const isMarketing = decodedCategory.includes('Marketing') || decodedCategory.toLowerCase().includes('marketing')
      const isDesign = decodedCategory.includes('Design') || decodedCategory.toLowerCase().includes('design')
      const isIDEs = decodedCategory.includes('IDEs') || decodedCategory.toLowerCase().includes('ide')
      const isCodingAgents = decodedCategory.includes('AI Coding Agents') || decodedCategory.toLowerCase().includes('coding agent') || decodedCategory.toLowerCase().includes('mcp')
      
      if (decodedCategory.includes(',')) {
        const categories = decodedCategory.split(',').map(c => c.trim()).filter(Boolean)
        // Build combined OR query with categories and tags
        let orConditions = categories.map(cat => `category.ilike.${cat}`).join(',')
        
        // For Marketing, Design, IDEs, and AI Coding Agents, add tag conditions to the OR query
        if (isMarketing) {
          orConditions += ',tags.cs.{marketing},tags.cs.{marketing-automation},tags.cs.{advertising},tags.cs.{seo}'
        }
        if (isDesign) {
          orConditions += ',tags.cs.{design},tags.cs.{ui},tags.cs.{ux},tags.cs.{graphic-design},tags.cs.{design-tools}'
        }
        if (isIDEs) {
          orConditions += ',tags.cs.{ide},tags.cs.{development-environment},tags.cs.{code-editor},tags.cs.{programming-environment},tags.cs.{vs-code},tags.cs.{visual-studio}'
        }
        if (isCodingAgents) {
          orConditions += ',tags.cs.{mcp},tags.cs.{model-context-protocol},tags.cs.{coding-agent},tags.cs.{code-agent},tags.cs.{figma-integration},tags.cs.{agentic-coding}'
        }
        
        queryBuilder = queryBuilder.or(orConditions)
      } else {
        // For single category, combine with tag search if needed
        if (isMarketing) {
          queryBuilder = queryBuilder.or(`category.ilike.${decodedCategory},tags.cs.{marketing},tags.cs.{marketing-automation},tags.cs.{advertising},tags.cs.{seo}`)
        } else if (isDesign) {
          queryBuilder = queryBuilder.or(`category.ilike.${decodedCategory},tags.cs.{design},tags.cs.{ui},tags.cs.{ux},tags.cs.{graphic-design},tags.cs.{design-tools}`)
        } else if (isIDEs) {
          queryBuilder = queryBuilder.or(`category.ilike.${decodedCategory},tags.cs.{ide},tags.cs.{development-environment},tags.cs.{code-editor},tags.cs.{programming-environment},tags.cs.{vs-code},tags.cs.{visual-studio}`)
        } else if (isCodingAgents) {
          queryBuilder = queryBuilder.or(`category.ilike.${decodedCategory},tags.cs.{mcp},tags.cs.{model-context-protocol},tags.cs.{coding-agent},tags.cs.{code-agent},tags.cs.{figma-integration},tags.cs.{agentic-coding}`)
        } else {
          queryBuilder = queryBuilder.ilike('category', decodedCategory)
        }
      }
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

