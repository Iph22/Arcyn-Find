/**
 * ArcynFind Search Pipeline — Gemini-powered ranking layer
 *
 * Takes raw hybrid search results and runs them through the Gemini AI
 * for intent-aware re-ranking, filtering, and scoring.
 *
 * Falls back to deterministic local orchestrator if Gemini is unavailable.
 */

import { GoogleGenerativeAI } from "@google/generative-ai"
import { runSearchOrchestrator, type CandidateResult, type OrchestratorOutput } from "./search-orchestrator"
import { logger } from "./logger"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// Tiered model system matching lib/gemini.ts
const PRIMARY_MODEL = "gemini-3-flash-preview"
const FALLBACK_MODEL = "gemini-flash-latest"

const SYSTEM_PROMPT = `You are ArcynFind Search Orchestrator. Your ONLY job is to filter, score, rank, and return search results with maximum relevance and consistency. You are NOT a chatbot. You do NOT invent results. You do NOT randomize output. Return ONLY valid JSON — no extra text, no markdown fences.`

// In-memory cache to avoid redundant Gemini calls for the same query+results
const pipelineCache = new Map<string, { data: OrchestratorOutput, timestamp: number }>()
const PIPELINE_CACHE_TTL = 1000 * 60 * 30 // 30 minutes
const PIPELINE_CACHE_MAX = 200

/**
 * Run the full search pipeline:
 *   1. Try Gemini AI-powered ranking
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

    // Try Gemini-powered ranking
    if (process.env.GEMINI_API_KEY) {
        try {
            const aiResult = await rankWithGemini(query, results)
            if (aiResult) {
                // Cache the result
                if (pipelineCache.size >= PIPELINE_CACHE_MAX) {
                    const firstKey = pipelineCache.keys().next().value
                    if (firstKey) pipelineCache.delete(firstKey)
                }
                pipelineCache.set(cacheKey, { data: aiResult, timestamp: Date.now() })

                logger.info(`[SearchPipeline] Gemini ranking returned ${aiResult.results.length} results (intent: ${aiResult.query_intent}, confidence: ${aiResult.confidence_level})`)
                return aiResult
            }
        } catch (error: any) {
            logger.warn("[SearchPipeline] Gemini ranking failed, falling back to local orchestrator:", error?.message || error)
        }
    }

    // Fallback: local deterministic orchestrator
    logger.info("[SearchPipeline] Using local deterministic orchestrator (Gemini unavailable or failed).")
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

/**
 * Call Gemini to re-rank search results with intent-aware scoring.
 * Returns null on failure so caller can fall back gracefully.
 */
async function rankWithGemini(query: string, results: any[]): Promise<OrchestratorOutput | null> {
    const MAX_RETRIES = 2
    const RETRY_DELAY_MS = 1000

    const userMessage = `User Query: ${query}\n\nCandidate Results:\n${JSON.stringify(results, null, 2)}`

    const fullPrompt = `${SYSTEM_PROMPT}\n\n${userMessage}\n\nRank and return the results as JSON matching this exact schema:\n{\n  "query_intent": "navigational | informational | transactional | comparative | exploratory",\n  "confidence_level": "high | medium | low",\n  "results": [\n    {\n      "rank": 1,\n      "title": "...",\n      "summary": "one sentence summary in your own words",\n      "source": "...",\n      "relevance_reason": "why this result wins this rank",\n      "stability_tier": "tier_A | tier_B | tier_C",\n      "score": 0.0\n    }\n  ],\n  "pipeline_health": {\n    "input_pool_size": 0,\n    "after_filter_size": 0,\n    "weak_input_detected": false\n  },\n  "notes": "any issues flagged"\n}\n\nRules:\n- Never invent results or URLs\n- Never exceed 10 results\n- Never score missing fields as anything other than 0\n- Never include tier_C results in the initial set\n- Sort by score descending, deterministic order\n- Return ONLY the JSON object, nothing else`

    // Try primary model first
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL })
            const result = await model.generateContent(fullPrompt)
            const text = result.response.text()
            return parseGeminiResponse(text)
        } catch (error: any) {
            const isRetryable = error?.status === 429 || error?.status === 503
            if (isRetryable && attempt < MAX_RETRIES - 1) {
                logger.warn(`[SearchPipeline] ${PRIMARY_MODEL} error (${error.status}), retrying in ${RETRY_DELAY_MS * (attempt + 1)}ms...`)
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)))
                continue
            }
            if (isRetryable) {
                logger.warn(`[SearchPipeline] ${PRIMARY_MODEL} unavailable. Trying ${FALLBACK_MODEL}...`)
                break
            }
            throw error
        }
    }

    // Try fallback model
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ model: FALLBACK_MODEL })
            const result = await model.generateContent(fullPrompt)
            const text = result.response.text()
            return parseGeminiResponse(text)
        } catch (error: any) {
            const isRetryable = error?.status === 429 || error?.status === 503
            if (isRetryable && attempt < MAX_RETRIES - 1) {
                logger.warn(`[SearchPipeline] ${FALLBACK_MODEL} error (${error.status}), retrying...`)
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)))
                continue
            }
            logger.error(`[SearchPipeline] Both Gemini models failed. Returning null for local fallback.`)
            return null
        }
    }

    return null
}

/**
 * Parse Gemini's response text into OrchestratorOutput.
 * Handles markdown fences and extra whitespace gracefully.
 */
function parseGeminiResponse(text: string): OrchestratorOutput | null {
    try {
        // Strip markdown code fences if present
        let jsonStr = text
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim()

        // Find the first { and last } to extract the JSON object
        const firstBrace = jsonStr.indexOf('{')
        const lastBrace = jsonStr.lastIndexOf('}')
        if (firstBrace === -1 || lastBrace === -1) {
            logger.error("[SearchPipeline] Gemini response contains no JSON object.")
            return null
        }
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)

        const parsed = JSON.parse(jsonStr) as OrchestratorOutput

        // Validate required fields
        if (!parsed.query_intent || !parsed.results || !Array.isArray(parsed.results)) {
            logger.error("[SearchPipeline] Gemini response missing required fields (query_intent, results).")
            return null
        }

        // Ensure pipeline_health exists
        if (!parsed.pipeline_health) {
            parsed.pipeline_health = {
                input_pool_size: 0,
                after_filter_size: parsed.results.length,
                weak_input_detected: false,
            }
        }

        return parsed
    } catch (error) {
        logger.error("[SearchPipeline] Failed to parse Gemini response:", error)
        return null
    }
}
