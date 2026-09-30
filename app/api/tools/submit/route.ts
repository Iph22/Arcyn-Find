import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/google-auth'
import { screenSubmission } from '@/lib/submission-screening'
import { createReviewToken } from '@/lib/submission-review'
import { renderReviewEmail, sendMail } from '@/lib/notifications/submission-emails'
import { appOrigin } from '@/lib/request-origin'
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

        // Signed in, or not at all.
        //
        // An unauthenticated public form is a spam funnel: every rejected
        // submission still costs a screening -- an outbound fetch of whatever
        // URL was supplied -- and a reviewer's attention. Requiring an account
        // does not stop a determined submitter, but it puts a name against
        // every entry and a rate limit that survives a new IP.
        //
        // It also makes the required email honest. A stranger typing an
        // address into a box is a claim; a signed-in account is one we already
        // reached once.
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json(
                {
                    error: 'Sign in to submit a tool.',
                    code: 'AUTH_REQUIRED',
                    signInUrl: '/sign-in?redirect=%2Fsubmit',
                },
                { status: 401 }
            )
        }

        // Validate required fields
        const { name, description, url, category } = body
        if (!name || !description || !url) {
            return NextResponse.json(
                { error: 'Missing required fields: name, description, url' },
                { status: 400 }
            )
        }

        // Email is required, and this is the reason: every submission now ends
        // in a decision, and a decision nobody hears about is indistinguishable
        // from being ignored. Someone who took the time to submit a tool is owed
        // an answer either way.
        // The account's address wins over the form field: it is the one we
        // have actually delivered to, and it cannot be mistyped here.
        const email = (user.email || (typeof body.email === 'string' ? body.email.trim() : '')).trim()
        if (!email || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email) || email.length > 254) {
            return NextResponse.json(
                { error: 'A valid email address is required so we can tell you the outcome.' },
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

        // Screen before storing, so the reviewer has the evidence in front of
        // them rather than a name and a link. Deterministic and model-free --
        // see lib/submission-screening.ts for why, and for why a site that
        // refuses bots is not counted against the submitter.
        const reviewToken = createReviewToken()
        const screening = await screenSubmission({
            name: name.trim(),
            description: description.trim(),
            url: url.trim(),
            tags: body.tags || [],
        })

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
                submitted_by: email,
                review_token: reviewToken,
                status: 'pending',
                screening,
                screening_score: screening.score,
                image_url: typeof body.imageUrl === 'string' ? body.imageUrl : null,
                submitted_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) {
            // There is deliberately no fallback here.
            //
            // This used to catch "does not exist" and insert straight into
            // ai_tools, answering "Tool submitted and added directly!" -- so an
            // error inserting into the review queue published unreviewed,
            // user-supplied content to the live catalog. The table does exist,
            // so it never fired (verified: zero rows in ai_tools carry the
            // `submitted-` id prefix it generated), but any future error whose
            // message happened to contain that phrase would have tripped it.
            //
            // A submission that cannot be queued is a submission that failed.
            // Losing one is recoverable; publishing an unreviewed one is not.
            console.error('[Submit] Error:', error)
            return NextResponse.json({ error: 'Failed to submit tool' }, { status: 500 })
        }

        // Tell the reviewer. Best-effort on purpose: the submission is already
        // stored, so a mail failure must not turn a saved submission into an
        // error the submitter sees. It is logged loudly instead, because a
        // queue nobody is told about is a queue nobody empties.
        const reviewTo = process.env.SUBMISSION_REVIEW_EMAIL || process.env.RESEND_FROM_EMAIL
        if (reviewTo) {
            const message = renderReviewEmail({
                submission: {
                    name: name.trim(),
                    description: description.trim(),
                    url: trimmedUrl,
                    category: finalCategory,
                    submittedBy: email,
                    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
                },
                screening,
                // appOrigin, not siteUrl(). siteUrl() answers "what is the
                // canonical public origin" -- https only, falling back to
                // production -- which is right for a canonical tag and wrong
                // for a link somebody has to click. On a local server it made
                // the emailed Approve button open arcynfind.com, where the
                // review page does not exist yet, and 404.
                reviewUrl: `${appOrigin(request)}/review/${reviewToken}`,
            })
            const sent = await sendMail(reviewTo, message)
            if (!sent.sent) {
                console.error(`[Submit] stored, but the review email failed: ${sent.reason}`)
            }
        } else {
            console.error(
                '[Submit] stored, but no reviewer address is configured. ' +
                'Set SUBMISSION_REVIEW_EMAIL — until then submissions queue silently.'
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Thanks! We will review this and email you either way.',
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
