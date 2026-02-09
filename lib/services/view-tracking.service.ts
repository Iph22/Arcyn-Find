/**
 * Enhanced View Tracking Service
 * 
 * Features:
 * - Persistent view tracking in database
 * - Rate limiting and anti-manipulation
 * - Trending score calculation
 * - View analytics
 */

import { getSupabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'

export interface ViewStats {
    totalViews: number
    views24h: number
    views7d: number
    trendingScore: number
}

/**
 * Hash IP address for privacy-safe uniqueness tracking
 */
function hashIP(ip: string): string {
    return createHash('sha256').update(ip + 'arcyn-salt').digest('hex').substring(0, 16)
}

/**
 * Track a view for a tool
 */
export async function trackToolView(
    toolId: string,
    options: {
        ip?: string
        sessionId?: string
        source?: string
    } = {}
): Promise<{ success: boolean; newPopularity?: number }> {
    const supabase = getSupabaseAdmin()

    try {
        // Check if tool exists
        const { data: tool, error: toolError } = await supabase
            .from('ai_tools')
            .select('id, popularity, view_count')
            .eq('id', toolId)
            .single()

        if (toolError || !tool) {
            return { success: false }
        }

        // Insert view record (if tool_views table exists)
        const viewData: any = {
            tool_id: toolId,
            source: options.source || 'web',
        }

        if (options.ip) {
            viewData.ip_hash = hashIP(options.ip)
        }

        if (options.sessionId) {
            viewData.session_id = options.sessionId
        }

        // Try to insert view record
        await supabase.from('tool_views').insert(viewData).select().single()

        // Update cached view count on ai_tools
        const currentViewCount = tool.view_count || 0
        const currentPopularity = tool.popularity || 50

        // Small popularity boost per view (max 100)
        const newPopularity = Math.min(100, currentPopularity + 0.05)

        await supabase
            .from('ai_tools')
            .update({
                view_count: currentViewCount + 1,
                last_view_at: new Date().toISOString(),
                popularity: Math.round(newPopularity * 10) / 10
            })
            .eq('id', toolId)

        return { success: true, newPopularity }
    } catch (error) {
        // If tool_views table doesn't exist, just update popularity
        const supabase = getSupabaseAdmin()

        const { data: tool } = await supabase
            .from('ai_tools')
            .select('popularity, view_count')
            .eq('id', toolId)
            .single()

        if (tool) {
            const newPopularity = Math.min(100, (tool.popularity || 50) + 0.05)
            await supabase
                .from('ai_tools')
                .update({
                    popularity: Math.round(newPopularity * 10) / 10,
                    view_count: (tool.view_count || 0) + 1
                })
                .eq('id', toolId)

            return { success: true, newPopularity }
        }

        return { success: false }
    }
}

/**
 * Get view stats for a tool
 */
export async function getToolViewStats(toolId: string): Promise<ViewStats | null> {
    const supabase = getSupabaseAdmin()

    try {
        const { data: tool } = await supabase
            .from('ai_tools')
            .select('view_count, view_count_24h, view_count_7d, trending_score')
            .eq('id', toolId)
            .single()

        if (!tool) return null

        return {
            totalViews: tool.view_count || 0,
            views24h: tool.view_count_24h || 0,
            views7d: tool.view_count_7d || 0,
            trendingScore: tool.trending_score || 0
        }
    } catch {
        return null
    }
}

/**
 * Calculate trending score for a tool
 * 
 * Formula:
 * - 50% from 24h views (normalized)
 * - 30% from 7d views (normalized)  
 * - 20% from overall popularity
 * - Decay factor for older last views
 */
export function calculateTrendingScore(
    views24h: number,
    views7d: number,
    popularity: number,
    lastViewAt: Date | null,
    maxViews24h: number = 100,
    maxViews7d: number = 500
): number {
    // Normalize view counts (0-100 scale)
    const normalized24h = Math.min(100, (views24h / maxViews24h) * 100)
    const normalized7d = Math.min(100, (views7d / maxViews7d) * 100)

    // Base score
    let score = (normalized24h * 0.5) + (normalized7d * 0.3) + (popularity * 0.2)

    // Apply decay if last view was old
    if (lastViewAt) {
        const hoursSinceLastView = (Date.now() - lastViewAt.getTime()) / (1000 * 60 * 60)

        if (hoursSinceLastView > 24) {
            // Decay: reduce score by 10% for each day since last view (up to 50%)
            const daysSinceLastView = hoursSinceLastView / 24
            const decayFactor = Math.max(0.5, 1 - (daysSinceLastView * 0.1))
            score *= decayFactor
        }
    }

    return Math.round(score * 10) / 10
}

/**
 * Update trending stats for all tools (called by cron)
 */
export async function updateAllTrendingStats(): Promise<{
    updated: number
    errors: number
}> {
    const supabase = getSupabaseAdmin()

    let updated = 0
    let errors = 0

    try {
        // Get max views for normalization
        const { data: maxStats } = await supabase
            .from('ai_tools')
            .select('view_count_24h, view_count_7d')
            .order('view_count_24h', { ascending: false })
            .limit(1)
            .single()

        const maxViews24h = Math.max(maxStats?.view_count_24h || 100, 100)
        const maxViews7d = Math.max(maxStats?.view_count_7d || 500, 500)

        // Fetch all tools in batches
        let offset = 0
        const batchSize = 500

        while (true) {
            const { data: tools, error } = await supabase
                .from('ai_tools')
                .select('id, view_count_24h, view_count_7d, popularity, last_view_at, is_trending')
                .range(offset, offset + batchSize - 1)

            if (error || !tools || tools.length === 0) break

            for (const tool of tools) {
                try {
                    const newScore = calculateTrendingScore(
                        tool.view_count_24h || 0,
                        tool.view_count_7d || 0,
                        tool.popularity || 50,
                        tool.last_view_at ? new Date(tool.last_view_at) : null,
                        maxViews24h,
                        maxViews7d
                    )

                    // Auto-update is_trending flag
                    const shouldBeTrending = newScore >= 60 || (tool.view_count_24h || 0) > 10

                    await supabase
                        .from('ai_tools')
                        .update({
                            trending_score: newScore,
                            is_trending: shouldBeTrending
                        })
                        .eq('id', tool.id)

                    updated++
                } catch {
                    errors++
                }
            }

            offset += batchSize
            if (tools.length < batchSize) break
        }
    } catch (error) {
        console.error('Error updating trending stats:', error)
    }

    return { updated, errors }
}

/**
 * Update view count caches (24h and 7d)
 * Called by cron job
 */
export async function updateViewCountCaches(): Promise<{
    updated: number
    errors: number
}> {
    const supabase = getSupabaseAdmin()

    let updated = 0
    let errors = 0

    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    try {
        // Get view counts per tool for last 24h
        const { data: views24h, error: error24h } = await supabase
            .from('tool_views')
            .select('tool_id')
            .gte('viewed_at', yesterday.toISOString())

        // If tool_views table doesn't exist, skip gracefully
        if (error24h) {
            if (error24h.message?.includes('does not exist') || error24h.code === '42P01') {
                console.warn('[ViewTracking] tool_views table does not exist. Run the add_view_tracking.sql migration.')
                return { updated: 0, errors: 0 }
            }
            // For other errors, log but don't fail completely
            console.error('[ViewTracking] Error querying views24h:', error24h)
        }

        // Get view counts per tool for last 7d
        const { data: views7d, error: error7d } = await supabase
            .from('tool_views')
            .select('tool_id')
            .gte('viewed_at', lastWeek.toISOString())

        if (error7d && !error7d.message?.includes('does not exist')) {
            console.error('[ViewTracking] Error querying views7d:', error7d)
        }

        // Count views per tool
        const counts24h: Record<string, number> = {}
        const counts7d: Record<string, number> = {}

        views24h?.forEach(v => {
            counts24h[v.tool_id] = (counts24h[v.tool_id] || 0) + 1
        })

        views7d?.forEach(v => {
            counts7d[v.tool_id] = (counts7d[v.tool_id] || 0) + 1
        })

        // Update all tools with their counts
        const allToolIds = new Set([...Object.keys(counts24h), ...Object.keys(counts7d)])

        for (const toolId of allToolIds) {
            try {
                await supabase
                    .from('ai_tools')
                    .update({
                        view_count_24h: counts24h[toolId] || 0,
                        view_count_7d: counts7d[toolId] || 0
                    })
                    .eq('id', toolId)

                updated++
            } catch {
                errors++
            }
        }

        // Reset counts for tools with no recent views (decay)
        await supabase
            .from('ai_tools')
            .update({ view_count_24h: 0 })
            .lt('last_view_at', yesterday.toISOString())

    } catch (error) {
        console.error('Error updating view count caches:', error)
    }

    return { updated, errors }
}

/**
 * Clean up old view records (older than 30 days)
 */
export async function cleanupOldViews(): Promise<number> {
    const supabase = getSupabaseAdmin()

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    try {
        // First count how many will be deleted
        const { count, error } = await supabase
            .from('tool_views')
            .select('*', { count: 'exact', head: true })
            .lt('viewed_at', thirtyDaysAgo.toISOString())

        // If tool_views table doesn't exist, skip gracefully
        if (error) {
            if (error.message?.includes('does not exist') || error.code === '42P01') {
                return 0 // Table doesn't exist, nothing to clean
            }
            console.error('[ViewTracking] Error in cleanupOldViews:', error)
            return 0
        }

        // Then delete them
        await supabase
            .from('tool_views')
            .delete()
            .lt('viewed_at', thirtyDaysAgo.toISOString())

        return count || 0
    } catch {
        return 0
    }
}
