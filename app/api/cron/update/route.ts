import { NextResponse } from 'next/server'
import { discoverNewTools, fetchMissingLogos } from '@/lib/auto-update'

// Allow longer runtime for expanded discovery (searches 12 topics)
export const maxDuration = 120 // 120 seconds
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    // Security: Check for Cron Secret
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    const authHeader = req.headers.get('authorization')

    const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-key' // fallback for dev

    if (authHeader !== `Bearer ${CRON_SECRET}` && key !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // 1. Discover tools (1 random topic, max 20 items)
        const discoveryResult = await discoverNewTools()

        // 2. Fetch logos for existing tools (batch of 5)
        const logoResult = await fetchMissingLogos(5)

        return NextResponse.json({
            success: true,
            discovery: discoveryResult,
            logos: logoResult,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error('Cron job failed:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
