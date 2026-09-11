/**
 * Candidate retrieval for goal-shaped queries.
 *
 * Extracted verbatim from /api/recommend, which had this inline. Phase 3 needs
 * it PER STEP of a generated stack, and two copies of a three-tier retrieval
 * pipeline would drift apart within a week.
 *
 * Three tiers, in order:
 *   1. hybrid       semantic + FTS via search_tools_advanced. Needs a query
 *                   embedding, which shares the Gemini quota — so this tier
 *                   silently disappears when the quota is exhausted, and the
 *                   answers change when it does. That is not hypothetical:
 *                   "summarize long research papers" returns ResearchRabbit via
 *                   hybrid and Article Summarizer via FTS. Callers that compare
 *                   results across runs must report which tier served them.
 *   2. traditional  full-text search over ai_tools_fts_idx. NOT ILIKE: an
 *                   ILIKE OR-chain over name/description takes 8.5s-to-timeout
 *                   on this 260k-row table even with trigram indexes. See
 *                   supabase/migrations/fix_advanced_search_bounded_retrieval.sql.
 *   3. none         genuinely nothing matched. Distinct from an error, which is
 *                   logged and falls through to the next tier.
 */

import { getSupabaseAdmin, AI_TOOLS_COLUMNS } from "./supabase"
import { logger } from "./logger"
import { hybridSearch, isSemanticSearchAvailable } from "./embeddings"
import { processSearchQuery } from "./search-utils"
import type { RecommendableTool } from "./recommend"

export type RetrievalSource = "hybrid" | "traditional" | "none"

export interface RetrievalResult {
    candidates: RecommendableTool[]
    source: RetrievalSource
}

/** Default candidate count. 30 is what the recommendation path has always
 *  used: enough for the orchestrator to tier and dedupe, small enough that the
 *  pricing lookup below stays a single bounded primary-key query. */
export const DEFAULT_CANDIDATE_LIMIT = 30

interface ToolRow {
    id: string
    name: string
    category: string
    description: string | null
    platform: string
    access_type: string
    pricing: string | null
    tags: string[] | null
    popularity: number | null
    pricing_model?: string | null
    price_monthly_min_usd?: number | string | null
    price_monthly_max_usd?: number | string | null
    has_free_tier?: boolean | null
    has_free_trial?: boolean | null
}

/** PostgREST returns numeric columns as strings; coerce so downstream
 *  comparisons are numeric rather than lexicographic. */
export function toNum(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null
    const n = typeof value === "number" ? value : parseFloat(value)
    return Number.isFinite(n) ? n : null
}

function toRecommendable(row: ToolRow): RecommendableTool {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description || "",
        platform: row.platform,
        pricing: row.pricing || "",
        accessType: row.access_type || "Freemium",
        tags: row.tags || [],
        popularity: row.popularity || 0,
        pricingModel: row.pricing_model ?? null,
        priceMonthlyMinUsd: toNum(row.price_monthly_min_usd),
        priceMonthlyMaxUsd: toNum(row.price_monthly_max_usd),
        hasFreeTier: row.has_free_tier ?? null,
        hasFreeTrial: row.has_free_trial ?? null,
    }
}

/**
 * Attach the structured pricing columns to hybrid results.
 *
 * search_tools_advanced's RETURNS TABLE predates those columns and doesn't
 * return them, so rather than revise a migration that has already been through
 * several rounds, fetch them by id for the candidates we actually have. One
 * bounded primary-key lookup.
 *
 * Non-fatal on failure: everything downstream treats missing pricing as
 * "unknown", which is already a case it must handle.
 */
async function enrichPricing(candidates: RecommendableTool[]): Promise<RecommendableTool[]> {
    if (candidates.length === 0) return candidates

    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from("ai_tools")
            .select("id, pricing_model, price_monthly_min_usd, price_monthly_max_usd, has_free_tier, has_free_trial")
            .in("id", candidates.map(c => c.id))

        if (error) {
            logger.warn("[Retrieval] Pricing enrichment failed:", error.message)
            return candidates
        }
        if (!data) return candidates

        const byId = new Map(data.map(r => [r.id, r]))
        return candidates.map(c => {
            const p = byId.get(c.id)
            return p
                ? {
                    ...c,
                    pricingModel: p.pricing_model ?? null,
                    priceMonthlyMinUsd: toNum(p.price_monthly_min_usd),
                    priceMonthlyMaxUsd: toNum(p.price_monthly_max_usd),
                    hasFreeTier: p.has_free_tier ?? null,
                    hasFreeTrial: p.has_free_trial ?? null,
                }
                : c
        })
    } catch (error) {
        logger.warn("[Retrieval] Pricing enrichment threw:", error)
        return candidates
    }
}

/**
 * Retrieve candidate tools for one query.
 *
 * Never throws and never returns null — a failed tier is logged and the next
 * one runs. An empty `candidates` with source "none" means nothing matched,
 * which callers must treat as a legitimate answer rather than an error.
 */
export async function retrieveCandidates(
    query: string,
    limit: number = DEFAULT_CANDIDATE_LIMIT
): Promise<RetrievalResult> {
    const trimmed = query.trim()
    if (!trimmed) return { candidates: [], source: "none" }

    // Tier 1: hybrid.
    try {
        if (await isSemanticSearchAvailable()) {
            const processed = processSearchQuery(trimmed)
            const hybridResponse = await hybridSearch(trimmed, limit, 0.20, processed.expanded)

            if (hybridResponse.status === "ok" && hybridResponse.results.length > 0) {
                const candidates = hybridResponse.results.map(r => ({
                    id: r.id,
                    name: r.title,
                    category: r.category,
                    description: r.description || "",
                    platform: r.platform,
                    pricing: r.pricing || "",
                    accessType: r.access_type || "Freemium",
                    tags: r.tags || [],
                    popularity: r.popularity || 0,
                }))
                return { candidates: await enrichPricing(candidates), source: "hybrid" }
            }

            if (hybridResponse.status === "error") {
                logger.warn(
                    `[Retrieval] hybridSearch degraded (${hybridResponse.errorReason}) — falling back to FTS`
                )
            }
        }
    } catch (error) {
        logger.warn("[Retrieval] Semantic retrieval unavailable:", error)
    }

    // Tier 2: full-text search.
    try {
        const supabase = getSupabaseAdmin()
        const processed = processSearchQuery(trimmed)
        const terms = processed.expanded.length > 0 ? processed.expanded : [trimmed]
        const sanitized = terms
            .map(term => term.replace(/[^\w\s-]/g, " ").trim())
            .filter(Boolean)
            .join(" | ")

        const { data, error } = await supabase
            .from("ai_tools")
            .select(AI_TOOLS_COLUMNS)
            .textSearch("fts_vector", sanitized || trimmed.replace(/[^\w\s-]/g, " ").trim(), {
                config: "english",
            })
            .order("priority", { ascending: false, nullsFirst: false })
            .order("popularity", { ascending: false })
            .limit(limit)

        if (error) {
            logger.error("[Retrieval] FTS error:", error.message)
        } else if (data && data.length > 0) {
            // AI_TOOLS_COLUMNS already includes the pricing columns, so no
            // enrichment pass is needed on this tier.
            return {
                candidates: (data as unknown as ToolRow[]).map(toRecommendable),
                source: "traditional",
            }
        }
    } catch (error) {
        logger.error("[Retrieval] FTS failed:", error)
    }

    return { candidates: [], source: "none" }
}
