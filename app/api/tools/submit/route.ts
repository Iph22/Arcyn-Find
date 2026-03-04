import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * POST /api/tools/submit
 * 
 * Public endpoint for users to submit new AI tools.
 * Submitted tools go into a pending review queue.
 * This is the #1 growth driver for tool directories — crowd-sourced submissions.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Validate required fields
        const { name, description, url, category } = body
        if (!name || !description || !url) {
            return NextResponse.json(
                { error: 'Missing required fields: name, description, url' },
                { status: 400 }
            )
        }

        if (name.length > 100) {
            return NextResponse.json({ error: 'Name too long (max 100 characters)' }, { status: 400 })
        }

        if (description.length > 500) {
            return NextResponse.json({ error: 'Description too long (max 500 characters)' }, { status: 400 })
        }

        // Validate URL format
        try {
            new URL(url)
        } catch {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
        }

        const supabase = getSupabaseAdmin()

        // Check if tool already exists (by name or URL)
        const { data: existing } = await supabase
            .from('ai_tools')
            .select('id, name')
            .or(`name.ilike.%${name}%,platform.eq.${url}`)
            .limit(1)

        if (existing && existing.length > 0) {
            return NextResponse.json(
                { error: 'A tool with this name or URL already exists', existingTool: existing[0].name },
                { status: 409 }
            )
        }

        // Also check the submissions table to avoid duplicates
        const { data: existingSubmission } = await supabase
            .from('tool_submissions')
            .select('id')
            .or(`name.ilike.%${name}%,url.eq.${url}`)
            .limit(1)

        if (existingSubmission && existingSubmission.length > 0) {
            return NextResponse.json(
                { error: 'This tool has already been submitted and is pending review' },
                { status: 409 }
            )
        }

        // Determine valid categories
        const validCategories = [
            'AI Agents', 'Code & Development', 'ChatBots', 'Writing & Content',
            'Image Generation', 'Productivity', 'Audio & Music', 'Data & Analytics',
            'Education', 'Marketing', 'Video Generation', 'AI Detection',
            'HR & Recruiting', 'Customer Service', 'Translation', 'Research',
            'Healthcare', 'Finance', 'Gaming', '3D & Spatial', 'Computer Vision',
            'Generative AI', 'NLP & Text Analysis', 'Other'
        ]

        const finalCategory = validCategories.includes(category) ? category : 'Other'

        // Insert into submissions table
        const { data: submission, error } = await supabase
            .from('tool_submissions')
            .insert({
                name: name.trim().substring(0, 100),
                description: description.trim().substring(0, 500),
                url: url.trim(),
                category: finalCategory,
                pricing: body.pricing || 'Unknown',
                access_type: body.accessType || 'Unknown',
                tags: body.tags || [],
                submitted_by: body.email || null,
                status: 'pending',
                submitted_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) {
            // If the submissions table doesn't exist, insert directly into ai_tools
            if (error.message?.includes('does not exist') || error.code === '42P01') {
                const toolId = `submitted-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}-${Date.now()}`

                const { error: insertError } = await supabase
                    .from('ai_tools')
                    .insert({
                        id: toolId,
                        name: name.trim().substring(0, 100),
                        description: description.trim().substring(0, 500),
                        platform: url.trim(),
                        category: finalCategory,
                        pricing: body.pricing || 'Unknown',
                        access_type: body.accessType || 'Unknown',
                        tags: body.tags || [],
                        popularity: 50,
                        region: 'Global',
                        last_updated: new Date().toISOString().split('T')[0],
                        is_trending: false,
                        image: null,
                    })

                if (insertError) {
                    console.error('[Submit] Error inserting tool:', insertError)
                    return NextResponse.json({ error: 'Failed to submit tool' }, { status: 500 })
                }

                return NextResponse.json({
                    success: true,
                    message: 'Tool submitted and added directly!',
                    toolId,
                })
            }

            console.error('[Submit] Error:', error)
            return NextResponse.json({ error: 'Failed to submit tool' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Tool submitted for review! It will appear after approval.',
            submissionId: submission?.id,
        })
    } catch (error) {
        console.error('[Submit] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * GET /api/tools/submit
 * Returns submission categories for forms
 */
export async function GET() {
    return NextResponse.json({
        categories: [
            'AI Agents', 'Code & Development', 'ChatBots', 'Writing & Content',
            'Image Generation', 'Productivity', 'Audio & Music', 'Data & Analytics',
            'Education', 'Marketing', 'Video Generation', 'AI Detection',
            'HR & Recruiting', 'Customer Service', 'Translation', 'Research',
            'Healthcare', 'Finance', 'Gaming', '3D & Spatial', 'Computer Vision',
            'Generative AI', 'NLP & Text Analysis', 'Other'
        ],
        accessTypes: ['Free', 'Freemium', 'Paid', 'Free Trial', 'Enterprise'],
    })
}
