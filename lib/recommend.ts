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

import { z } from "zod"
import { parseStructured, isAIConfigured } from "./ai-provider"
import type { RankedResult } from "./search-orchestrator"
import { logger } from "./logger"

// ONE bounded attempt, no retries — this runs in a user-facing request with a
// hard deadline, and the deterministic template below is always available.
const REASONING_TIMEOUT_MS = 15_000
const MAX_CANDIDATES_FOR_REASONING = 6

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
    /** true when AI reasoning was unavailable and we fell back to the
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

    if (isAIConfigured()) {
        try {
            const llmResult = await reasonWithAI(query, candidates)
            if (llmResult) return { query, ...llmResult, degraded: false }
        } catch (error: any) {
            logger.warn("[Recommend] AI reasoning failed, using deterministic fallback:", error?.message || error)
        }
    }

    return { query, ...buildDeterministicRecommendation(candidates), degraded: true }
}

// ---------------------------------------------------------------------------
// LLM reasoning — bounded to MAX_CANDIDATES_FOR_REASONING, never the full DB.
// ---------------------------------------------------------------------------


const REASONING_SYSTEM_PROMPT = `You are ArcynFind's recommendation reasoner. You are given a user's goal and a SHORT list of pre-vetted candidate tools — already retrieved and scored. You are not searching, only explaining.

ABSOLUTE RULES:
- Choose bestMatch and alternatives ONLY from the provided candidate ids. Never invent a tool, id, name, or URL.
- Never state a numeric confidence or match percentage — the label enum carries that meaning instead.
- Keep every reason to one plain-language sentence about the user's actual goal.
- Omit limitation entirely if the tool has no notable downside for this goal. Never invent one.`

interface LLMReasoningResult {
    bestMatch: RecommendedTool
    alternatives: RecommendedTool[]
}

/** The model returns ids + prose only; we join the real tool records back
 *  ourselves. That means it cannot fabricate pricing, URLs, or tags even if it
 *  tries — the worst it can do is pick a bad id, which we validate below. */
const ReasoningSchema = z.object({
    bestMatchId: z.string().describe("One of the candidate ids, exactly"),
    bestMatchReason: z.string().describe("One sentence on why this best fits the goal"),
    bestMatchStrengths: z.array(z.string()).describe("Short capability phrases"),
    bestMatchLimitation: z.string().nullable().describe("One sentence, or null if none"),
    alternatives: z.array(z.object({
        id: z.string().describe("One of the candidate ids, exactly"),
        label: z.enum(["best_budget", "best_for_beginners", "best_for_professionals", "most_popular", "strong_alternative"]),
        reasonToPick: z.string().describe("One sentence"),
    })).describe("At most 3, never the bestMatchId"),
})

async function reasonWithAI(
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

    const parsed = await parseStructured(
        ReasoningSchema,
        `User's goal: "${query}"

Candidates:
${JSON.stringify(candidateManifest, null, 2)}

Pick the single best match for this goal and up to 3 alternatives, each with a
label explaining what makes it worth considering instead.`,
        {
            timeoutMs: REASONING_TIMEOUT_MS,
            // No effort override: this is the text a user actually reads, so it
            // gets the model's default (high).
            system: REASONING_SYSTEM_PROMPT,
            label: "reasonWithAI",
        }
    )

    if (!parsed) return null

    const byId = new Map(candidates.map(c => [c.tool.id, c.tool]))
    const bestTool = byId.get(parsed.bestMatchId)
    if (!bestTool) {
        logger.warn("[Recommend] Model chose a bestMatchId outside the candidate set — discarding.")
        return null
    }

    const bestMatch: RecommendedTool = {
        ...bestTool,
        label: 'best_match',
        reason: parsed.bestMatchReason,
        strengths: parsed.bestMatchStrengths.slice(0, 5),
        limitation: parsed.bestMatchLimitation ?? undefined,
    }

    const alternatives: RecommendedTool[] = parsed.alternatives
        .filter(a => a.id !== parsed.bestMatchId && byId.has(a.id))
        .slice(0, 3)
        .map((a): RecommendedTool => ({
            ...byId.get(a.id)!,
            label: a.label,
            reason: a.reasonToPick,
            strengths: [],
        }))

    return { bestMatch, alternatives }
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
