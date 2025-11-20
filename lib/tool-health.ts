/**
 * Tool Health Monitoring Utilities
 * Checks if AI tool platforms are accessible and tracks their status
 */

export interface ToolHealthStatus {
  toolId: string
  platform: string
  status: 'up' | 'down' | 'unknown' | 'checking'
  lastChecked: number
  responseTime?: number
  error?: string
}

const HEALTH_CACHE_KEY = 'arcyn-find-tool-health'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Check if a tool's platform is accessible
 * Uses CORS proxy or HEAD request to check status
 */
export async function checkToolHealth(platform: string, toolId: string): Promise<ToolHealthStatus> {
  const cached = getCachedHealth(toolId)
  if (cached && Date.now() - cached.lastChecked < CACHE_DURATION) {
    return cached
  }

  const status: ToolHealthStatus = {
    toolId,
    platform,
    status: 'checking',
    lastChecked: Date.now(),
  }

  try {
    // Use server-side API route to bypass CORS restrictions
    const apiUrl = `/api/check-url?url=${encodeURIComponent(platform)}`
    const startTime = Date.now()
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const response = await fetch(apiUrl, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      if (response.ok) {
        const data = await response.json()
        status.status = data.status as 'up' | 'down' | 'unknown'
        status.responseTime = data.responseTime || responseTime
        if (data.error) {
          status.error = data.error
        }
      } else {
        status.status = 'unknown'
        status.error = 'API check failed'
      }
    } catch (error) {
      clearTimeout(timeoutId)
      
      // If it's an abort error, it's a timeout
      if (error instanceof Error && error.name === 'AbortError') {
        status.status = 'down'
        status.error = 'Request timeout'
      } else {
        status.status = 'unknown'
        status.error = error instanceof Error ? error.message : 'Network error'
      }
    }
  } catch (error) {
    status.status = 'down'
    status.error = error instanceof Error ? error.message : 'Unknown error'
  }

  // Cache the result
  cacheHealthStatus(status)

  return status
}

/**
 * Check multiple tools' health status
 */
export async function checkMultipleToolsHealth(
  tools: Array<{ id: string; platform: string }>
): Promise<ToolHealthStatus[]> {
  // Check tools in parallel with a limit to avoid overwhelming the browser
  const BATCH_SIZE = 5
  const results: ToolHealthStatus[] = []

  for (let i = 0; i < tools.length; i += BATCH_SIZE) {
    const batch = tools.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(tool => checkToolHealth(tool.platform, tool.id))
    )
    results.push(...batchResults)

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < tools.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return results
}

/**
 * Get cached health status
 */
function getCachedHealth(toolId: string): ToolHealthStatus | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(HEALTH_CACHE_KEY)
    if (!cached) return null

    const healthMap: Record<string, ToolHealthStatus> = JSON.parse(cached)
    return healthMap[toolId] || null
  } catch {
    return null
  }
}

/**
 * Cache health status
 */
function cacheHealthStatus(status: ToolHealthStatus): void {
  if (typeof window === 'undefined') return

  try {
    const cached = localStorage.getItem(HEALTH_CACHE_KEY)
    const healthMap: Record<string, ToolHealthStatus> = cached ? JSON.parse(cached) : {}

    healthMap[status.toolId] = status

    // Keep only last 100 entries to prevent storage bloat
    const entries = Object.entries(healthMap)
    if (entries.length > 100) {
      // Remove oldest entries
      const sorted = entries.sort((a, b) => b[1].lastChecked - a[1].lastChecked)
      const trimmed = sorted.slice(0, 100)
      const trimmedMap: Record<string, ToolHealthStatus> = {}
      trimmed.forEach(([id, status]) => {
        trimmedMap[id] = status
      })
      localStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify(trimmedMap))
    } else {
      localStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify(healthMap))
    }
  } catch (error) {
    console.error('Failed to cache health status:', error)
  }
}

/**
 * Get health status for a tool (from cache or return unknown)
 */
export function getToolHealthStatus(toolId: string): ToolHealthStatus | null {
  return getCachedHealth(toolId)
}

/**
 * Get health status badge color
 */
export function getHealthStatusColor(status: ToolHealthStatus['status']): string {
  switch (status) {
    case 'up':
      return 'bg-green-500/20 text-green-400'
    case 'down':
      return 'bg-red-500/20 text-red-400'
    case 'checking':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'unknown':
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}

/**
 * Get health status label
 */
export function getHealthStatusLabel(status: ToolHealthStatus['status']): string {
  switch (status) {
    case 'up':
      return 'Online'
    case 'down':
      return 'Offline'
    case 'checking':
      return 'Checking...'
    case 'unknown':
    default:
      return 'Unknown'
  }
}

