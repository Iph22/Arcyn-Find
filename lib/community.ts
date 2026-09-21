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

    const rows = data || []

    // Resolve every referenced tool and collection in two queries.
    //
    // This loop used to issue one query per tool_id AND one per collection_id
    // while iterating -- up to 41 sequential round trips for a 20-item feed,
    // each one fetching a single `name`. Collecting the ids first turns that
    // into two `.in()` lookups that run concurrently.
    const toolIds = [...new Set(rows.map(a => a.tool_id).filter(Boolean))]
    const collectionIds = [...new Set(rows.map(a => a.collection_id).filter(Boolean))]

    const [toolRows, collectionRows] = await Promise.all([
      toolIds.length > 0
        ? supabase.from('ai_tools').select('id, name').in('id', toolIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      collectionIds.length > 0
        ? supabase.from('collections').select('id, name').in('id', collectionIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ])

    const toolNames = new Map((toolRows.data || []).map(t => [t.id, t.name]))
    const collectionNames = new Map((collectionRows.data || []).map(c => [c.id, c.name]))

    const activities: UserActivity[] = rows.map(activity => {
      const toolName = activity.tool_id ? toolNames.get(activity.tool_id) : undefined
      const collectionName = activity.collection_id
        ? collectionNames.get(activity.collection_id)
        : undefined

      return {
        ...activity,
        user: activity.user_profiles ? {
          username: activity.user_profiles.username,
          display_name: activity.user_profiles.display_name,
          avatar_url: activity.user_profiles.avatar_url,
        } : undefined,
        // Left undefined when the referenced row is gone, matching the
        // previous behaviour of skipping the assignment on a failed lookup.
        tool: toolName ? { name: toolName } : undefined,
        collection: collectionName ? { name: collectionName } : undefined,
      }
    })

    return activities
  } catch (error) {
    console.error('Error fetching activity feed:', error)
    return []
  }
}

/**
 * The columns of the `user_stats` view, which is defined in
 * 001_clerk_compatible_schema.sql and matches the UserStats interface exactly.
 *
 * Listing them rather than `select('*')` saves nothing today -- all ten are
 * used. It is here so that adding a column to the view does not silently widen
 * every response that reads it, which is how the `select('*')` on ai_tools
 * ended up shipping a 768-float embedding to clients.
 *
 * Worth knowing if this ever gets slow: `user_stats` is a view with four LEFT
 * JOINs and COUNT(DISTINCT ...) grouped over all of user_profiles, so an
 * ORDER BY over it aggregates every user before applying LIMIT. Fine at the
 * current scale; it will not stay fine.
 */
const USER_STATS_COLUMNS =
  'id, username, display_name, avatar_url, total_reviews, total_collections, followers_count, following_count, total_helpful_votes, last_review_date'

/**
 * Get user stats for leaderboard
 */
export async function getLeaderboard(limit: number = 10): Promise<UserStats[]> {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select(USER_STATS_COLUMNS)
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
      .select(USER_STATS_COLUMNS)
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

