/**
 * API Route to generate embeddings for AI tools
 * 
 * POST /api/admin/generate-embeddings
 * 
 * This endpoint generates semantic embeddings for all tools that don't have them.
 * Should be run after the pgvector migration is complete.
 * 
 * Requires admin authentication (API key in header).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { batchGenerateEmbeddings } from '@/lib/embeddings'
import { logger } from '@/lib/logger'

// Set longer timeout for embedding generation
export const maxDuration = 300 // 5 minutes

export async function POST(request: NextRequest) {
    // Simple API key authentication for admin routes
    const apiKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!expectedKey || apiKey !== expectedKey) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        )
    }

    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
            { error: 'GEMINI_API_KEY is not configured' },
            { status: 500 }
        )
    }

    const supabase = getSupabaseAdmin()

    try {
        // Check if embedding column exists
        const { error: checkError } = await supabase
            .from('ai_tools')
            .select('embedding')
            .limit(1)

        if (checkError) {
            return NextResponse.json(
                { error: 'Embedding column does not exist. Run the migration first.' },
                { status: 400 }
            )
        }

        // Get tools without embeddings
        const { data: tools, error: fetchError } = await supabase
            .from('ai_tools')
            .select('id, name, description, category, tags')
            .is('embedding', null)
            .limit(500) // Process in batches of 500

        if (fetchError) {
            logger.error('[Embeddings API] Error fetching tools:', fetchError)
            return NextResponse.json(
                { error: 'Failed to fetch tools' },
                { status: 500 }
            )
        }

        if (!tools || tools.length === 0) {
            return NextResponse.json({
                message: 'All tools already have embeddings',
                processed: 0
            })
        }

        logger.info(`[Embeddings API] Generating embeddings for ${tools.length} tools...`)

        // Generate embeddings in batches
        const embeddings = await batchGenerateEmbeddings(tools, (completed, total) => {
            logger.info(`[Embeddings API] Progress: ${completed}/${total}`)
        })

        logger.info(`[Embeddings API] Generated ${embeddings.size} embeddings out of ${tools.length} tools`)

        if (embeddings.size === 0) {
            return NextResponse.json({
                message: 'No embeddings could be generated. Check Gemini API key and quota.',
                processed: tools.length,
                updated: 0,
                failed: tools.length,
                remaining: tools.length
            })
        }

        // Update tools with their embeddings
        let updated = 0
        let failed = 0

        for (const [toolId, embedding] of embeddings) {
            // Convert array to pgvector format string: [1,2,3,...] 
            const vectorStr = `[${embedding.join(',')}]`

            const { error: updateError } = await supabase
                .from('ai_tools')
                .update({ embedding: vectorStr })
                .eq('id', toolId)

            if (updateError) {
                if (failed < 3) {
                    // Only log first few failures to avoid spam
                    logger.error(`[Embeddings API] Failed to update ${toolId}:`, updateError.message)
                }
                failed++
            } else {
                updated++
            }
        }

        // Get remaining count
        const { count: remaining } = await supabase
            .from('ai_tools')
            .select('id', { count: 'exact', head: true })
            .is('embedding', null)

        logger.info(`[Embeddings API] Completed: ${updated} updated, ${failed} failed, ${remaining} remaining`)

        return NextResponse.json({
            message: 'Embeddings generated successfully',
            processed: tools.length,
            generated: embeddings.size,
            updated,
            failed,
            remaining: remaining || 0
        })

    } catch (error) {
        logger.error('[Embeddings API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to generate embeddings' },
            { status: 500 }
        )
    }
}

// GET to check status
export async function GET(request: NextRequest) {
    const apiKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!expectedKey || apiKey !== expectedKey) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        )
    }

    const supabase = getSupabaseAdmin()

    try {
        // Check if embedding column exists
        const { error: checkError } = await supabase
            .from('ai_tools')
            .select('embedding')
            .limit(1)

        if (checkError) {
            return NextResponse.json({
                status: 'not_ready',
                message: 'Migration not run yet. Embedding column does not exist.',
                hasColumn: false
            })
        }

        // Count total tools
        const { count: total } = await supabase
            .from('ai_tools')
            .select('id', { count: 'exact', head: true })

        // Count tools with embeddings
        const { count: withEmbeddings } = await supabase
            .from('ai_tools')
            .select('id', { count: 'exact', head: true })
            .not('embedding', 'is', null)

        // Count tools without embeddings
        const { count: withoutEmbeddings } = await supabase
            .from('ai_tools')
            .select('id', { count: 'exact', head: true })
            .is('embedding', null)

        const percentComplete = total ? Math.round(((withEmbeddings || 0) / total) * 100) : 0

        return NextResponse.json({
            status: percentComplete === 100 ? 'complete' : 'in_progress',
            hasColumn: true,
            total: total || 0,
            withEmbeddings: withEmbeddings || 0,
            withoutEmbeddings: withoutEmbeddings || 0,
            percentComplete
        })

    } catch (error) {
        logger.error('[Embeddings API] Status check error:', error)
        return NextResponse.json(
            { error: 'Failed to check status' },
            { status: 500 }
        )
    }
}
