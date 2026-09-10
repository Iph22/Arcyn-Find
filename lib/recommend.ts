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
    /** Human-readable pricing text, for display. */
    pricing: string
    accessType: string
    tags: string[]
    popularity: number

    // Structured pricing (see lib/pricing.ts). Optional because ~1.4% of the
    // corpus is unclassified and because not every caller supplies it.
    pricingModel?: string | null
    /** USD/month for the cheapest paid tier. 0 = free, null = unpriced. */
    priceMonthlyMinUsd?: number | null
    priceMonthlyMaxUsd?: number | null
    hasFreeTier?: boolean | null
    hasFreeTrial?: boolean | null
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
        // Structured pricing alongside the prose, so cost comparisons in the
        // generated reasoning rest on normalized monthly figures instead of the
        // model having to interpret strings like "Free, $9.99/month, $99.99/year".
        pricing_model: tool.pricingModel ?? undefined,
        price_monthly_min_usd: tool.priceMonthlyMinUsd ?? undefined,
        price_monthly_max_usd: tool.priceMonthlyMaxUsd ?? undefined,
        has_free_tier: tool.hasFreeTier ?? undefined,
        has_free_trial: tool.hasFreeTrial ?? undefined,
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
            // Thinking deliberately left off (no `effort: "high"`): measured no
            // quality difference on this task — same tool chosen, schema still
            // valid — at roughly 7x the speed. See ai-provider.ts.
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
        // Deliberately EMPTY, not tags.
        //
        // This previously used `tool.tags.slice(0, 4)`, which the panel renders
        // under a "Why it fits ✓" heading — implying we analysed how the tool
        // serves this specific goal, when we had actually printed tag soup
        // ("AI", "video", "content creation"). That is the false-precision
        // failure the product brief calls out.
        //
        // Nothing reasoned about fit here, so nothing is claimed about fit. The
        // panel hides the section when this is empty and shows the tags in a
        // visually subdued row instead, so the information survives without the
        // unearned framing. `reason` is still real — it comes from the
        // orchestrator's own scoring.
        strengths: [],
    }

    const remaining = rest.slice(0, 3)

    // `best_budget` is now COMPUTED from structured pricing rather than guessed
    // from prose. The old version ran a regex over the free-text pricing field
    // — strip everything but digits and compare — which got "Free tier, Pro
    // $20/mo" vs "$9.99/month, $99.99/year" wrong (it compared 20 against
    // 999.99) and had no notion of billing period at all.
    const cheapestIdx = indexOfCheapest(remaining.map(c => c.tool))
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

/**
 * Index of the cheapest tool, or -1 when no tool has comparable price data.
 *
 * Ordering, cheapest first:
 *   1. a permanently free tier      (nothing beats free)
 *   2. lowest USD/month             (already period-normalized by lib/pricing.ts)
 *   3. a free trial                 (better than paying up front, but expires)
 *
 * Returns -1 rather than defaulting to index 0 when nothing is comparable —
 * labelling an arbitrary tool "best budget option" with no price data behind it
 * is exactly the kind of false confidence the product brief warns against.
 */
export function indexOfCheapest(tools: RecommendableTool[]): number {
    let bestIdx = -1
    let bestRank: [number, number] | null = null

    tools.forEach((tool, i) => {
        const price = tool.priceMonthlyMinUsd
        const hasPrice = typeof price === 'number' && Number.isFinite(price)

        // Tier first, then price within the tier. Lower sorts cheaper.
        const rank: [number, number] | null =
            tool.hasFreeTier || price === 0 ? [0, 0]
                : hasPrice ? [1, price as number]
                    : tool.hasFreeTrial ? [2, 0]
                        : null

        if (!rank) return
        if (!bestRank || rank[0] < bestRank[0] || (rank[0] === bestRank[0] && rank[1] < bestRank[1])) {
            bestRank = rank
            bestIdx = i
        }
    })

    return bestIdx
}
