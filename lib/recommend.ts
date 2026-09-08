/**
 * ArcynFind Recommendation Engine — Phase 1 vertical slice of the
 * Find -> Decide product direction.
 *
 * Deliberately thin: this module does NOT retrieve or rank candidates itself.
 * It takes an already-bounded, already-ranked candidate list (from
 * runSearchPipeline / search-orchestrator, which already does retrieval +
 * scoring against the full corpus) and does ONE more thing — turn the top
 * handful of candidates into an explained recommendation. This keeps the LLM
 * reasoning step cheap, fast, and bounded to ~6 candidates, never the full
 * tool database.
 */

import { GoogleGenerativeAI } from "@google/generative-ai"
import type { RankedResult } from "./search-orchestrator"
import { logger } from "./logger"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// Tiered model system + hard timeouts, matching lib/gemini.ts / lib/search-pipeline.ts.
// ONE bounded attempt per tier, no retry-with-backoff — this runs in the same
// user-facing request path with a hard deadline.
const PRIMARY_MODEL = "gemini-3-flash-preview"
const FALLBACK_MODEL = "gemini-flash-latest"
const PRIMARY_TIMEOUT_MS = 7000
const FALLBACK_TIMEOUT_MS = 6000
const MAX_CANDIDATES_FOR_REASONING = 6

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { status: 503, isTimeout: true }))
        }, ms)
        promise.then(
            (val) => { clearTimeout(timer); resolve(val) },
            (err) => { clearTimeout(timer); reject(err) }
        )
    })
}

export type RecommendationLabel =
    | 'best_match'
    | 'best_budget'
    | 'best_for_beginners'
    | 'best_for_professionals'
    | 'most_popular'
    | 'strong_alternative'

/** The subset of a tool's data needed to enrich a recommendation. Callers
 *  build this map from whatever row shape they already fetched candidates in
 *  (AIEntry, HybridSearchResult, etc.) — this module doesn't care which. */
export interface RecommendableTool {
    id: string
    name: string
    category: string
    description: string
    platform: string
    pricing: string
    accessType: string
    tags: string[]
    popularity: number
}

export interface RecommendedTool extends RecommendableTool {
    label: RecommendationLabel
    reason: string
    strengths: string[]
    limitation?: string
}

export interface Recommendation {
    query: string
    bestMatch: RecommendedTool | null
    alternatives: RecommendedTool[]
    /** true when Gemini reasoning was unavailable and we fell back to the
     *  deterministic template — callers can surface this as a subtle signal
     *  ("recommendation" vs "top match") without ever blocking on it. */
    degraded: boolean
}

/**
 * Build an explained recommendation from an already-ranked candidate set.
 *
 * @param query    Original user query (goal), used only for the reasoning prompt.
 * @param ranked   Output of runSearchPipeline/search-orchestrator — already
 *                 scored, tiered, deduped, capped at 10. tier_C is excluded
 *                 here per the orchestrator's own rule (never promote tier_C).
 * @param toolsById Full tool data keyed by id (falls back to matching by
 *                 lowercased title if id is missing), used to enrich the
 *                 chosen candidates with pricing/platform/tags for the response.
 */
export async function generateRecommendation(
    query: string,
    ranked: RankedResult[],
    toolsById: Map<string, RecommendableTool>
): Promise<Recommendation> {
    const eligible = ranked.filter(r => r.stability_tier !== 'tier_C')

    const resolveTool = (r: RankedResult): RecommendableTool | null => {
        if (r.id && toolsById.has(r.id)) return toolsById.get(r.id)!
        const byTitle = toolsById.get(r.title?.toLowerCase() ?? '')
        return byTitle ?? null
    }

    const candidates = eligible
        .slice(0, MAX_CANDIDATES_FOR_REASONING)
        .map(r => ({ ranked: r, tool: resolveTool(r) }))
        .filter((c): c is { ranked: RankedResult; tool: RecommendableTool } => c.tool !== null)

    if (candidates.length === 0) {
        return { query, bestMatch: null, alternatives: [], degraded: false }
    }

    if (process.env.GEMINI_API_KEY) {
        try {
            const llmResult = await reasonWithGemini(query, candidates)
            if (llmResult) return { query, ...llmResult, degraded: false }
        } catch (error: any) {
            logger.warn("[Recommend] Gemini reasoning failed, using deterministic fallback:", error?.message || error)
        }
    }

    return { query, ...buildDeterministicRecommendation(candidates), degraded: true }
}

// ---------------------------------------------------------------------------
// LLM reasoning — bounded to MAX_CANDIDATES_FOR_REASONING, never the full DB.
// ---------------------------------------------------------------------------

const REASONING_SYSTEM_PROMPT = `You are ArcynFind's recommendation reasoner. You are given a user's goal and a
SHORT list of pre-vetted candidate tools (already retrieved and scored — you are not searching, only explaining).

ABSOLUTE RULES:
- Choose bestMatch and alternatives ONLY from the provided candidate ids. Never invent a tool, id, name, or URL.
- Never output a numeric confidence/match percentage — use the provided label enum instead.
- Keep "reason" and "reasonToPick" to one sentence each, in plain language, about the user's actual goal.
- "limitation" is optional — omit it if the tool has no notable downside for this goal, don't invent one.
- Return ONLY valid JSON, no markdown fences, no extra text.`

interface LLMReasoningResult {
    bestMatch: RecommendedTool
    alternatives: RecommendedTool[]
}

async function reasonWithGemini(
    query: string,
    candidates: { ranked: RankedResult; tool: RecommendableTool }[]
): Promise<LLMReasoningResult | null> {
    const candidateManifest = candidates.map(({ ranked, tool }) => ({
        id: tool.id,
        name: tool.name,
        category: tool.category,
        description: tool.description,
        pricing: tool.pricing,
        accessType: tool.accessType,
        tags: tool.tags,
        tier: ranked.stability_tier,
        relevance_reason: ranked.relevance_reason,
    }))

    const prompt = `${REASONING_SYSTEM_PROMPT}

User's goal: "${query}"

Candidates (JSON):
${JSON.stringify(candidateManifest, null, 2)}

Return JSON matching exactly:
{
  "bestMatchId": "<one of the candidate ids>",
  "bestMatchReason": "one sentence on why this best fits the user's goal",
  "bestMatchStrengths": ["short capability phrase", "..."],
  "bestMatchLimitation": "one sentence, or omit the field entirely if there is none",
  "alternatives": [
    { "id": "<candidate id>", "label": "best_budget | best_for_beginners | best_for_professionals | most_popular | strong_alternative", "reasonToPick": "one sentence" }
  ]
}
Include at most 3 alternatives, never the same id as bestMatchId, never an id outside the candidate list.`

    const byId = new Map(candidates.map(c => [c.tool.id, c.tool]))

    const attempt = async (model: string, timeoutMs: number) => {
        const gen = genAI.getGenerativeModel({ model })
        const result = await withTimeout(gen.generateContent(prompt), timeoutMs, model)
        return parseReasoningResponse(result.response.text(), byId)
    }

    try {
        return await attempt(PRIMARY_MODEL, PRIMARY_TIMEOUT_MS)
    } catch (error: any) {
        const isRetryable = error?.status === 429 || error?.status === 503 || error?.isTimeout
        if (!isRetryable) throw error
        logger.warn(`[Recommend] ${PRIMARY_MODEL} unavailable (${error.status || 'timeout'}). Trying ${FALLBACK_MODEL}...`)
        return await attempt(FALLBACK_MODEL, FALLBACK_TIMEOUT_MS)
    }
}

function parseReasoningResponse(
    text: string,
    byId: Map<string, RecommendableTool>
): LLMReasoningResult | null {
    try {
        let jsonStr = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
        const firstBrace = jsonStr.indexOf('{')
        const lastBrace = jsonStr.lastIndexOf('}')
        if (firstBrace === -1 || lastBrace === -1) return null
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)

        const parsed = JSON.parse(jsonStr)
        const bestTool = byId.get(parsed.bestMatchId)
        if (!bestTool) {
            logger.warn("[Recommend] Gemini chose a bestMatchId outside the candidate set — discarding.")
            return null
        }

        const bestMatch: RecommendedTool = {
            ...bestTool,
            label: 'best_match',
            reason: typeof parsed.bestMatchReason === 'string' ? parsed.bestMatchReason : 'Strongest overall match for this goal.',
            strengths: Array.isArray(parsed.bestMatchStrengths) ? parsed.bestMatchStrengths.slice(0, 5) : [],
            limitation: typeof parsed.bestMatchLimitation === 'string' ? parsed.bestMatchLimitation : undefined,
        }

        const VALID_LABELS: RecommendationLabel[] = ['best_budget', 'best_for_beginners', 'best_for_professionals', 'most_popular', 'strong_alternative']
        const rawAlts = Array.isArray(parsed.alternatives) ? parsed.alternatives : []
        const alternatives: RecommendedTool[] = rawAlts
            .filter((a: any) => a && a.id !== parsed.bestMatchId && byId.has(a.id))
            .slice(0, 3)
            .map((a: any): RecommendedTool => ({
                ...byId.get(a.id)!,
                label: VALID_LABELS.includes(a.label) ? a.label : 'strong_alternative',
                reason: typeof a.reasonToPick === 'string' ? a.reasonToPick : 'A solid alternative worth considering.',
                strengths: [],
            }))

        return { bestMatch, alternatives }
    } catch (error) {
        logger.warn("[Recommend] Failed to parse Gemini reasoning response:", error)
        return null
    }
}

// ---------------------------------------------------------------------------
// Deterministic fallback — no AI calls. Uses the orchestrator's own scoring
// (relevance_reason, tier, rank) plus simple heuristics over price/popularity.
// ---------------------------------------------------------------------------

function buildDeterministicRecommendation(
    candidates: { ranked: RankedResult; tool: RecommendableTool }[]
): { bestMatch: RecommendedTool; alternatives: RecommendedTool[] } {
    const [top, ...rest] = candidates

    const bestMatch: RecommendedTool = {
        ...top.tool,
        label: 'best_match',
        reason: top.ranked.relevance_reason || top.ranked.summary || 'Highest-ranked match for this goal.',
        strengths: top.tool.tags.slice(0, 4),
    }

    const remaining = rest.slice(0, 3)
    const cheapestIdx = remaining.length > 0
        ? remaining.reduce((best, c, i) => isCheaper(c.tool.pricing, remaining[best].tool.pricing) ? i : best, 0)
        : -1
    const mostPopularIdx = remaining.length > 0
        ? remaining.reduce((best, c, i) => c.tool.popularity > remaining[best].tool.popularity ? i : best, 0)
        : -1

    const alternatives: RecommendedTool[] = remaining.map((c, i) => {
        const label: RecommendationLabel =
            i === cheapestIdx ? 'best_budget' :
                i === mostPopularIdx ? 'most_popular' :
                    'strong_alternative'
        return {
            ...c.tool,
            label,
            reason: c.ranked.relevance_reason || c.ranked.summary || 'A strong alternative for this goal.',
            strengths: [],
        }
    })

    return { bestMatch, alternatives }
}

function isCheaper(a: string, b: string): boolean {
    const isFree = (s: string) => /free/i.test(s)
    if (isFree(a) && !isFree(b)) return true
    if (!isFree(a) && isFree(b)) return false
    const numA = parseFloat(a.replace(/[^0-9.]/g, ''))
    const numB = parseFloat(b.replace(/[^0-9.]/g, ''))
    if (isNaN(numA) || isNaN(numB)) return false
    return numA < numB
}
