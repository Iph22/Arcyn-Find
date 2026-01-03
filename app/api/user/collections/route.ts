import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * GET /api/user/collections
 * Get the current user's collections
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const supabase = getSupabaseAdmin()

    // Get collections with item counts - FIXED N+1 query
    const { data: collections, error } = await supabase
      .from('collections')
      .select(`
        id,
        name,
        description,
        is_public,
        created_at,
        updated_at,
        collection_items(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform to include count without separate queries
    const collectionsWithCounts = (collections || []).map((collection) => ({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      is_public: collection.is_public,
      tools_count: collection.collection_items?.[0]?.count || 0,
      created_at: collection.created_at,
      updated_at: collection.updated_at
    }))

    return createSuccessResponse({ collections: collectionsWithCounts })
  } catch (error) {
    logger.error('Error fetching collections:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch collections',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

/**
 * POST /api/user/collections
 * Create a new collection
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const body = await request.json()
    const { name, description, is_public } = body

    if (!name) {
      return createErrorResponse('Collection name is required', 400, ErrorCodes.VALIDATION_ERROR)
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('collections')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        is_public: is_public ?? false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // Create activity
    await supabase
      .from('user_activities')
      .insert({
        user_id: user.id,
        activity_type: 'collection_created',
        collection_id: data.id,
        created_at: new Date().toISOString()
      })

    return createSuccessResponse({ collection: data })
  } catch (error) {
    logger.error('Error creating collection:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to create collection',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
