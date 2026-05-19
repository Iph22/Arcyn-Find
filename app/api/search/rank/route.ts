import { NextResponse } from 'next/server'
import { runSearchOrchestrator, type CandidateResult } from '@/lib/search-orchestrator'

export const runtime = 'nodejs'

/**
 * POST /api/search/rank
 *
 * ArcynFind Search Orchestrator endpoint.
 *
 * Request body (JSON):
 * {
 *   "query":   string,           // The raw user search query
 *   "results": CandidateResult[] // Candidate pool from your index / DB
 * }
 *
 * Response body (JSON):
 * OrchestratorOutput — strict shape defined in lib/search-orchestrator.ts
 *
 * NOTES:
 * - This endpoint does NOT modify the database.
 * - This endpoint does NOT auto-index or invent results.
 * - Output order is always deterministic for identical inputs.
 */
export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400 }
    )
  }

  // ── Input validation ──────────────────────────────────────────────────────
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Body must be a JSON object with "query" and "results" fields.' },
      { status: 400 }
    )
  }

  const { query, results } = body as Record<string, unknown>

  if (typeof query !== 'string') {
    return NextResponse.json(
      { error: '"query" must be a non-empty string.' },
      { status: 400 }
    )
  }

  if (!Array.isArray(results)) {
    return NextResponse.json(
      { error: '"results" must be an array of candidate objects.' },
      { status: 400 }
    )
  }

  // Validate each candidate has at minimum a title field
  for (let i = 0; i < results.length; i++) {
    const c = results[i]
    if (!c || typeof c !== 'object' || typeof (c as Record<string, unknown>).title !== 'string') {
      return NextResponse.json(
        { error: `results[${i}] is missing a required "title" string field.` },
        { status: 400 }
      )
    }
  }

  // ── Run the orchestrator ──────────────────────────────────────────────────
  try {
    const output = runSearchOrchestrator(
      query.trim(),
      results as CandidateResult[]
    )

    return NextResponse.json(output, {
      headers: {
        // Results are deterministic — safe to cache by CDN for short periods
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    console.error('[SearchOrchestrator] Unhandled pipeline error:', err)
    return NextResponse.json(
      { error: 'Internal orchestrator error. See server logs.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/search/rank
 * Returns metadata about the orchestrator for health-check / discovery.
 */
export async function GET() {
  return NextResponse.json({
    service: 'ArcynFind Search Orchestrator',
    version: '1.0.0',
    method: 'POST',
    pipeline_steps: [
      '1. Retrieval Gate',
      '2. Intent Detection',
      '3. Hard Filtering',
      '4. Scoring (FINAL_SCORE formula)',
      '5. Sort & Limit (max 10, min 3)',
      '6. Stability Guard (tier_A / tier_B / tier_C)',
      '7. Niche Authority Boost (+2 / -1)',
    ],
    intent_types: [
      'navigational',
      'informational',
      'transactional',
      'comparative',
      'exploratory',
    ],
    scoring_formula:
      '(Exact_KW×4) + (Semantic×3) + (Intent_Fit×4) + (Trust×3) + (Popularity×1) + (Freshness×1)',
    absolute_rules: [
      'Never invent a result, URL, or tool name.',
      'Never randomize result order.',
      'Never pad results to hit a count.',
      'Never exceed 10 results.',
      'Never score a missing field as anything other than 0.',
      'Never promote a tier_C result into the initial result set.',
      'Never modify the database during a query.',
    ],
  })
}
