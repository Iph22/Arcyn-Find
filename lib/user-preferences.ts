export interface UserPreferences {
  userRole?: "developer" | "student" | "designer" | "business" | "enthusiast" | null
  purpose?: string
  level?: string
  categories?: string[]
  features?: string[]
  completed?: boolean
  timestamp?: string
  [key: string]: unknown
}

/**
 * Save user preferences to database via API
 */
export async function saveUserPreferences(preferences: Partial<UserPreferences>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/user/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferences),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to save preferences' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error saving user preferences:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to save preferences'
    return { success: false, error: errorMessage }
  }
}

/**
 * Load user preferences from database via API
 */
export async function loadUserPreferences(): Promise<UserPreferences | null> {
  try {
    const response = await fetch('/api/user/preferences')
    
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.preferences || null
  } catch (error) {
    console.error('Error loading user preferences:', error)
    return null
  }
}

/**
 * Mark instructions as seen via API
 */
export async function markInstructionsSeen(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/user/instructions-seen', {
      method: 'POST',
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to mark instructions as seen' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error marking instructions as seen:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to mark instructions as seen'
    return { success: false, error: errorMessage }
  }
}

/**
 * Get user favorites via API
 */
export async function getUserFavorites(): Promise<string[]> {
  try {
    const response = await fetch('/api/favorites')
    
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.favorites?.map((f: any) => f.tool_id) || []
  } catch (error) {
    console.error('Error loading favorites:', error)
    return []
  }
}

/**
 * Add favorite via API
 */
export async function addFavorite(toolId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ toolId }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to add favorite' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error adding favorite:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to add favorite'
    return { success: false, error: errorMessage }
  }
}

/**
 * Remove favorite via API
 */
export async function removeFavorite(toolId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/favorites/${toolId}`, {
      method: 'DELETE',
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to remove favorite' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error removing favorite:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove favorite'
    return { success: false, error: errorMessage }
  }
}

