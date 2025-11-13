import { NextResponse } from 'next/server'
import { fetchAIModelsFromSources } from '@/lib/data-sources'

/**
 * POST /api/cron/update-models
 * Scheduled endpoint to refresh AI models data
 * Should be called by a cron job service (Vercel Cron, GitHub Actions, etc.)
 * 
 * To use with Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/update-models",
 *     "schedule": "0 0,6,12,18 * * *"
 *   }]
 * }
 * 
 * The schedule above runs every 6 hours (at 0, 6, 12, and 18 hours)
 */
export async function POST(request: Request) {
  // Verify authorization (optional but recommended)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Fetch fresh data from all sources
    const models = await fetchAIModelsFromSources()

    // Here you could:
    // 1. Store in a database
    // 2. Update a cache
    // 3. Trigger a rebuild
    // For now, we just fetch and let Next.js cache handle it

    return NextResponse.json({
      success: true,
      modelsCount: models.length,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating models:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Also allow GET for manual testing
export async function GET(request: Request) {
  return POST(request)
}

