import { supabase } from './supabase'
import { getCurrentUser } from '@/lib/google-auth'

export interface UserActivity {
  id: string
  user_id: string
  activity_type: 'review_created' | 'collection_created' | 'tool_favorited' | 'tool_added_to_collection' | 'review_helpful_voted'
  tool_id?: string
  collection_id?: string
  review_id?: string
  metadata?: any
  created_at: string
  user?: {
    username?: string
    display_name?: string
    avatar_url?: string
  }
  tool?: {
    name?: string
  }
  collection?: {
    name?: string
  }
}

export interface UserStats {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  total_reviews: number
  total_collections: number
  followers_count: number
  following_count: number
  total_helpful_votes: number
  last_review_date?: string
}

/**
 * Follow a user
 */
export async function followUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: 'You must be logged in' }
    }

    if (currentUser.id === userId) {
      return { success: false, error: 'You cannot follow yourself' }
    }

    const { error } = await supabase
      .from('user_follows')
      .insert({
        follower_id: currentUser.id,
        following_id: userId,
      })

    if (error) {
      if (error.code === '23505') { // Unique constraint
        return { success: false, error: 'You are already following this user' }
      }
      throw error
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error following user:', error)
    return { success: false, error: error.message || 'Failed to follow user' }
  }
}

/**
 * Unfollow a user
 */
export async function unfollowUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: 'You must be logged in' }
    }

    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', currentUser.id)
      .eq('following_id', userId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error unfollowing user:', error)
    return { success: false, error: error.message || 'Failed to unfollow user' }
  }
}

/**
 * Check if current user is following a user
 */
export async function isFollowingUser(userId: string): Promise<boolean> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return false

    const { data } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', userId)
      .single()

    return !!data
  } catch {
    return false
  }
}

/**
 * Get activity feed for current user (activities from users they follow + their own)
 */
export async function getActivityFeed(limit: number = 20): Promise<UserActivity[]> {
  try {
    const user = await getCurrentUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('user_activities')
      .select(`
        *,
        user_profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    // Fetch tool/collection details for activities
    const activities: UserActivity[] = []
    for (const activity of data || []) {
      const activityData: UserActivity = {
        ...activity,
        user: activity.user_profiles ? {
          username: activity.user_profiles.username,
          display_name: activity.user_profiles.display_name,
          avatar_url: activity.user_profiles.avatar_url,
        } : undefined,
      }

      // Fetch tool name if tool_id exists
      if (activity.tool_id) {
        const { data: tool } = await supabase
          .from('ai_tools')
          .select('name')
          .eq('id', activity.tool_id)
          .single()
        if (tool) {
          activityData.tool = { name: tool.name }
        }
      }

      // Fetch collection name if collection_id exists
      if (activity.collection_id) {
        const { data: collection } = await supabase
          .from('collections')
          .select('name')
          .eq('id', activity.collection_id)
          .single()
        if (collection) {
          activityData.collection = { name: collection.name }
        }
      }

      activities.push(activityData)
    }

    return activities
  } catch (error) {
    console.error('Error fetching activity feed:', error)
    return []
  }
}

/**
 * Get user stats for leaderboard
 */
export async function getLeaderboard(limit: number = 10): Promise<UserStats[]> {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .order('total_helpful_votes', { ascending: false })
      .order('total_reviews', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return []
  }
}

/**
 * Get user stats
 */
export async function getUserStats(userId: string): Promise<UserStats | null> {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return null
  }
}

