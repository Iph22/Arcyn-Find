/**
 * ArcynFind Search Pipeline — AI-powered ranking layer
 *
 * Takes raw hybrid search results and runs them through the configured AI provider
 * for intent-aware re-ranking, filtering, and scoring.
 *
 * Falls back to deterministic local orchestrator if the AI provider is unavailable.
 */

import { z } from "zod"
import { parseStructured, isAIConfigured } from "./ai-provider"
import { runSearchOrchestrator, type CandidateResult, type OrchestratorOutput } from "./search-orchestrator"
import { logger } from "./logger"

// Ranking runs inside the user-facing search request, so it gets a hard
// deadline and exactly one attempt — on failure we fall through to the local
// deterministic orchestrator, which is always available.
const RANK_TIMEOUT_MS = 15_000

const SYSTEM_PROMPT = `You are the ArcynFind Search Orchestrator. Your only job is to filter, score, and rank search results for maximum relevance and consistency. You are not a chatbot. Never invent results. Never randomize output — identical input must produce identical ranking.`

// In-memory cache to avoid redundant AI calls for the same query+results
const pipelineCache = new Map<string, { data: OrchestratorOutput, timestamp: number }>()
const PIPELINE_CACHE_TTL = 1000 * 60 * 30 // 30 minutes
const PIPELINE_CACHE_MAX = 200

/**
 * Run the full search pipeline:
 *   1. Try AI-powered ranking
 *   2. Falls back to local deterministic orchestrator on any failure
 *
 * @param query   The raw user search query
 * @param results The candidate results from hybridSearch (already normalized)
 * @returns       OrchestratorOutput — strict ranked JSON
 */
export async function runSearchPipeline(
    query: string,
    results: any[]
): Promise<OrchestratorOutput> {
    if (!results || results.length === 0) {
        logger.info("[SearchPipeline] No candidate results — skipping pipeline.")
        return runSearchOrchestrator(query, [])
    }

    // Check cache
    const cacheKey = `pipeline:${query.toLowerCase().trim()}:${results.length}`
    const cached = pipelineCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp < PIPELINE_CACHE_TTL)) {
        logger.info("[SearchPipeline] Returning cached pipeline result.")
        return cached.data
    }

    // Try AI-powered ranking
    if (isAIConfigured()) {
        try {
            const aiResult = await rankWithAI(query, results)
            if (aiResult) {
                // Cache the result
                if (pipelineCache.size >= PIPELINE_CACHE_MAX) {
                    const firstKey = pipelineCache.keys().next().value
                    if (firstKey) pipelineCache.delete(firstKey)
                }
                pipelineCache.set(cacheKey, { data: aiResult, timestamp: Date.now() })

                logger.info(`[SearchPipeline] AI ranking returned ${aiResult.results.length} results (intent: ${aiResult.query_intent}, confidence: ${aiResult.confidence_level})`)
                return aiResult
            }
        } catch (error: any) {
            logger.warn("[SearchPipeline] AI ranking failed, falling back to local orchestrator:", error?.message || error)
        }
    }

    // Fallback: local deterministic orchestrator
    logger.info("[SearchPipeline] Using local deterministic orchestrator (AI unavailable or failed).")
    const candidates: CandidateResult[] = results.map((r: any) => ({
        id: r.id,
        title: r.title || r.name,
        description: r.description,
        source: r.platform || r.url,
        tags: r.tags,
        keyword_score: (r.keyword_score || 0) * 10,   // Scale 0–1 → 0–10 for orchestrator
        vector_score: (r.vector_score || 0) * 10,
        popularity_score: (r.popularity_score || 0) * 10,
        source_trust_score: (r.source_trust_score || 0) * 10,
        freshness_date: r.freshness_date || r.last_updated,
        is_verified: (r.source_trust_score || 0) >= 0.7,
        auto_indexed: false,
        category: r.category,
    }))

    const localResult = runSearchOrchestrator(query, candidates)

    // Cache the fallback result too
    if (pipelineCache.size >= PIPELINE_CACHE_MAX) {
        const firstKey = pipelineCache.keys().next().value
        if (firstKey) pipelineCache.delete(firstKey)
    }
    pipelineCache.set(cacheKey, { data: localResult, timestamp: Date.now() })

    return localResult
}


// ---------------------------------------------------------------------------
// AI-powered ranking
// ---------------------------------------------------------------------------

/** Mirrors OrchestratorOutput so the model's response is schema-validated on
 *  arrival. Replaces the previous approach of stripping markdown fences,
 *  slicing between the first and last brace, and JSON.parse-ing the remainder —
 *  which could yield a wrong-shaped object that passed a couple of ad-hoc
 *  field checks and then broke downstream. */
const RankedResultSchema = z.object({
    rank: z.number(),
    id: z.string().optional(),
    title: z.string(),
    summary: z.string().describe("One sentence, in your own words"),
    source: z.string(),
    relevance_reason: z.string().describe("Why this result earns this rank"),
    stability_tier: z.enum(["tier_A", "tier_B", "tier_C"]),
    score: z.number(),
})

const OrchestratorOutputSchema = z.object({
    query_intent: z.enum(["navigational", "informational", "transactional", "comparative", "exploratory"]),
    confidence_level: z.enum(["high", "medium", "low"]),
    results: z.array(RankedResultSchema),
    pipeline_health: z.object({
        input_pool_size: z.number(),
        after_filter_size: z.number(),
        weak_input_detected: z.boolean(),
    }),
    notes: z.string().describe("Any issues worth flagging"),
})

/**
 * Re-rank candidates with intent-aware scoring.
 *
 * ONE bounded attempt, no retries — the local deterministic orchestrator is the
 * correct fallback, not a slower retry. Returns null on any failure.
 */
async function rankWithAI(query: string, results: any[]): Promise<OrchestratorOutput | null> {
    const parsed = await parseStructured(
        OrchestratorOutputSchema,
        `User query: ${query}

Candidate results:
${JSON.stringify(results, null, 2)}

Rank these candidates. Rules:
- Never invent results or URLs — rank only what is given above.
- Return at most 10 results.
- Score any missing field as 0, never as a guess.
- Do not include tier_C results in the returned set.
- Sort by score descending. Identical input must produce identical output.`,
        {
            timeoutMs: RANK_TIMEOUT_MS,
            effort: "medium",
            system: SYSTEM_PROMPT,
            label: "rankWithAI",
        }
    )

    if (!parsed) return null

    // Enforce the two invariants the prompt asks for but can't guarantee.
    const filtered = parsed.results
        .filter(r => r.stability_tier !== "tier_C")
        .slice(0, 10)

    return { ...parsed, results: filtered } as OrchestratorOutput
}
