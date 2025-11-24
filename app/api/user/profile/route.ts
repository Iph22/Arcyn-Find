import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/user/profile
 * Get the current user's profile
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    // Get user profile from Supabase
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Profile doesn't exist yet
        return createSuccessResponse({ profile: null })
      }
      throw error
    }

    return createSuccessResponse({ profile: data })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch profile',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

/**
 * PUT /api/user/profile
 * Update the current user's profile
 * Requires authentication
 */
export async function PUT(request: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    // Parse request body
    const body = await request.json()
    const { display_name, username, bio, avatar_url, banner_url } = body

    // Upsert user profile in Supabase
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        display_name,
        username,
        bio,
        avatar_url,
        banner_url,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return createSuccessResponse({ profile: data })
  } catch (error) {
    console.error('Error updating user profile:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update profile',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
