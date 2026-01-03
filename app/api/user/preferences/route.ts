import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/google-auth'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * GET /api/user/preferences
 * Get user preferences
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_role, purpose, experience_level, categories, features, onboarding_completed, onboarding_completed_at, instructions_seen, preferences')
      .eq('id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile yet
        return createSuccessResponse({ preferences: null })
      }
      throw error
    }

    if (!data) {
      return createSuccessResponse({ preferences: null })
    }

    const prefs = data.preferences as Record<string, unknown> || {}

    const preferences = {
      userRole: data.user_role,
      purpose: data.purpose || undefined,
      level: data.experience_level || undefined,
      categories: data.categories || [],
      features: data.features || [],
      completed: data.onboarding_completed || false,
      timestamp: data.onboarding_completed_at || undefined,
      instructionsSeen: data.instructions_seen || false,
      userEmail: (prefs.userEmail as string) || undefined,
      userName: (prefs.userName as string) || undefined,
      ...prefs,
    }

    return createSuccessResponse({ preferences })
  } catch (error) {
    logger.error('Error fetching user preferences:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch preferences',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

/**
 * PUT /api/user/preferences
 * Update user preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
    }

    const body = await request.json()
    const {
      userRole,
      purpose,
      level,
      categories,
      features,
      completed,
      email_notifications,
      notify_new_followers,
      notify_reviews,
      notify_marketing,
      profile_visibility,
      show_activity_status,
      allow_search_indexing,
      show_in_suggestions
    } = body

    const supabase = getSupabaseAdmin()

    // Prepare update object - only include fields that are provided
    const updateData: Record<string, unknown> = {
      id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (userRole !== undefined) updateData.user_role = userRole || null
    if (purpose !== undefined) updateData.purpose = purpose || null
    if (level !== undefined) updateData.experience_level = level || null
    if (categories !== undefined) updateData.categories = categories || []
    if (features !== undefined) updateData.features = features || []
    if (completed !== undefined) {
      updateData.onboarding_completed = completed
      updateData.onboarding_completed_at = completed ? new Date().toISOString() : null
    }

    // Always update preferences JSON with all provided fields
    updateData.preferences = body as Record<string, unknown>

    const { error } = await supabase
      .from('user_profiles')
      .upsert(updateData, {
        onConflict: 'id',
      })

    if (error) {
      throw error
    }

    return createSuccessResponse({ message: 'Preferences saved successfully' })
  } catch (error) {
    logger.error('Error saving user preferences:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to save preferences',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
