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

/**
 * Relevance signals produced by retrieval itself.
 *
 * These were being DISCARDED, and it was the main reason recommendation quality
 * was stuck. search_tools_advanced computes a hybrid relevance score (vector
 * similarity + FTS rank + source trust + popularity), this module dropped all
 * of it while mapping to RecommendableTool, and /api/recommend then handed the
 * ranking orchestrator `keyword_score: 0.5, vector_score: 0.5,
 * source_trust_score: 0.5` — identical constants for every candidate. Three of
 * the orchestrator's six scoring terms therefore contributed the same amount to
 * everything, leaving keyword overlap, intent heuristics and popularity to
 * decide the winner.
 *
 * That is why a direct RPC probe ranked "Sweep" first for "find and fix bugs in
 * my codebase" while the app returned "TLDR": the SQL got it right and the JS
 * re-rank threw the answer away.
 *
 * Optional because the FTS tier cannot supply all of them — see the note where
 * it builds them. Callers must treat a missing field as "unknown", never as 0.
 */
export interface RetrievalScores {
    /** FTS rank, 0-1. Undefined on tiers that do not compute one. */
    keyword_score?: number
    /** Cosine similarity against the query embedding, 0-1. */
    vector_score?: number
    /** Derived from the row's `priority` column, 0-1. */
    source_trust_score?: number
    /** The SQL function's own blended score. Not on a 0-1 scale. */
    combined_score?: number
    freshness_date?: string | null
    is_trending?: boolean
}

export interface RetrievedTool extends RecommendableTool {
    scores?: RetrievalScores
}

export interface RetrievalResult {
    candidates: RetrievedTool[]
    source: RetrievalSource
}

/** Default candidate count. 30 is what the recommendation path has always
 *  used: enough for the orchestrator to tier and dedupe, small enough that the
 *  pricing lookup below stays a single bounded primary-key query. */
export const DEFAULT_CANDIDATE_LIMIT = 30

/** The weight search_tools_advanced gives vector similarity inside
 *  combined_score. Must track the migration if that changes. */
const SIM_WEIGHT = 3.0

/**
 * Ranking score per candidate id, correcting for PARTIAL EMBEDDING COVERAGE.
 *
 * The SQL computes `COALESCE(vc.sim, 0.0) * 3.0`, so a tool with no embedding is
 * scored as if it were measured and found maximally dissimilar. It wasn't
 * measured at all. While coverage is incomplete that hands every embedded row a
 * systematic bonus of up to 3.0 that has nothing to do with relevance — the
 * same "unknown is not zero" mistake RetrievalScores warns callers about above.
 *
 * It is not hypothetical. Backfilling embeddings for the most-viewed rows took
 * coverage from 11% to 56% and precision@1 FELL from 88% to 81%, because the
 * newly embedded rows displaced better answers purely by having a vector.
 * Measured on the labeled set at 56% coverage
 * (scripts/eval/ranking-offline.mts):
 *
 *     production, missing sim scored as 0        81%
 *     vector term removed entirely               77%   <- similarity does help
 *     missing sim scored as the pool mean        85%   <- this
 *
 * So the fix is neither "trust vectors more" nor "trust them less": it is to
 * stop treating an absent measurement as a bad one. Substituting the mean
 * similarity of the embedded rows in the same pool is the neutral choice.
 *
 * This becomes a no-op at full coverage, which is where the corpus should end
 * up — it corrects a transitional distortion, and correctly does nothing once
 * there is nothing to correct.
 */
export function coverageAdjustedScores(candidates: RetrievedTool[]): Map<string, number> {
    const scores = new Map<string, number>()

    const sims = candidates
        .map(c => c.scores?.vector_score)
        .filter((v): v is number => typeof v === "number" && v > 0)

    // Nothing to correct when every row has an embedding, or none does.
    const uniform = sims.length === 0 || sims.length === candidates.length
    const meanSim = uniform ? 0 : sims.reduce((a, b) => a + b, 0) / sims.length

    for (const c of candidates) {
        const base = c.scores?.combined_score ?? 0
        const sim = c.scores?.vector_score ?? 0
        scores.set(c.id, uniform || sim > 0 ? base : base + SIM_WEIGHT * meanSim)
    }
    return scores
}

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
    priority?: number | null
    last_updated?: string | null
    is_trending?: boolean | null
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

function toRecommendable(row: ToolRow): RetrievedTool {
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
        // The FTS tier runs a plain SELECT, so it has no relevance rank and no
        // embedding distance to report. Only the signals that genuinely exist
        // on the row are set; keyword_score and vector_score are left undefined
        // so callers substitute a neutral value rather than treating "unknown"
        // as "zero relevance", which would rank every FTS result last.
        scores: {
            source_trust_score: Math.min((row.priority ?? 50) / 100, 1),
            freshness_date: row.last_updated ?? null,
            is_trending: row.is_trending ?? false,
        },
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
async function enrichPricing(candidates: RetrievedTool[]): Promise<RetrievedTool[]> {
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
                const candidates: RetrievedTool[] = hybridResponse.results.map(r => ({
                    id: r.id,
                    name: r.title,
                    category: r.category,
                    description: r.description || "",
                    platform: r.platform,
                    pricing: r.pricing || "",
                    accessType: r.access_type || "Freemium",
                    tags: r.tags || [],
                    popularity: r.popularity || 0,
                    // Carried through rather than dropped — see RetrievalScores.
                    scores: {
                        keyword_score: r.keyword_score,
                        vector_score: r.vector_score,
                        source_trust_score: r.source_trust_score,
                        combined_score: r.combined_score,
                        freshness_date: r.freshness_date,
                        is_trending: r.is_trending,
                    },
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
