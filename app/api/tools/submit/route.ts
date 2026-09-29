import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { normalizeName } from '@/lib/seo/slug'

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
        const trimmedUrl = url.trim()

        // Does the catalog already hold this tool?
        //
        // Two exact lookups, rather than the one PostgREST .or() filter with
        // an ILIKE in it that this used to be. That had three problems.
        //
        //   1. INJECTION. The submitted name was interpolated raw into
        //      PostgREST filter syntax. A name containing a comma or a
        //      parenthesis -- "Copy.ai, Inc" -- rewrites the filter rather
        //      than being matched by it, and this endpoint is public and
        //      unauthenticated.
        //   2. ILIKE is not viable on ai_tools. Measured at 8.5s against a
        //      statement timeout of roughly 8-9s, and the cost is driven by
        //      trigram commonality rather than selectivity, so a RARER name
        //      can be slower than a common one. That makes it unpredictable
        //      rather than merely slow. See docs/CORPUS_AND_CONSTRAINTS.md
        //      section 2.
        //   3. It matched substrings, so any submission whose name occurred
        //      inside a name already in the catalog was rejected as a
        //      duplicate. "Sora" is a substring of "Sorasearch".
        //
        // existing_tool_names() is the RPC the ingest already uses for this
        // exact question. It matches the indexed normalized_name generated
        // column and returns DISTINCT, so it is an index scan and cannot
        // truncate against PostgREST's silent 1000-row cap. normalizeName()
        // is the JS half of that column's definition -- keep the two in step.
        const [nameLookup, urlLookup] = await Promise.all([
            supabase.rpc('existing_tool_names', { p_names: [normalizeName(name)] }),
            supabase.from('ai_tools').select('name').eq('platform', trimmedUrl).limit(1),
        ])

        const duplicateName = (nameLookup.data?.length ?? 0) > 0
        const duplicateUrl = urlLookup.data?.[0]?.name

        if (duplicateName || duplicateUrl) {
            return NextResponse.json(
                {
                    error: 'A tool with this name or URL already exists',
                    existingTool: duplicateUrl ?? name.trim(),
                },
                { status: 409 }
            )
        }

        // The same question of the pending queue. tool_submissions has no
        // normalized_name column, but it is small, and these are exact
        // matches: .ilike() with no wildcards is case-insensitive equality,
        // not the substring scan above. Passing the values as filter
        // arguments rather than building the string also keeps the injection
        // fix from point 1.
        const [pendingByName, pendingByUrl] = await Promise.all([
            supabase.from('tool_submissions').select('id').ilike('name', name.trim()).limit(1),
            supabase.from('tool_submissions').select('id').eq('url', trimmedUrl).limit(1),
        ])

        if ((pendingByName.data?.length ?? 0) > 0 || (pendingByUrl.data?.length ?? 0) > 0) {
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
