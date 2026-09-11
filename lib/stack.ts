/**
 * Phase 3 — Solution Architect.
 *
 * Turns a goal into a STACK: several complementary tools arranged as ordered
 * steps, with a combined monthly cost. The Phase 2 recommendation answers
 * "which tool", this answers "what do I actually need to do this".
 *
 * THE CENTRAL PROBLEM, stated plainly: retrieval returns tools SIMILAR to the
 * query, and a stack needs tools that are DIFFERENT from each other and
 * complementary. Searching "launch a podcast" once returns thirty podcast
 * tools, not a recording tool plus a transcriber plus a clip generator. So the
 * goal is decomposed into steps first, and each step runs its own focused
 * retrieval — the case where retrieval is strongest, because a step query like
 * "transcribe audio to text" is short and unambiguous.
 *
 * ONE model call per stack, for the decomposition. Picking the tool for each
 * step is deliberately NOT a model call: each step query is already narrow, and
 * N extra calls would multiply the quota cost of a feature that already depends
 * on the same exhausted Gemini budget as everything else.
 *
 * WHEN THE MODEL IS UNAVAILABLE there are two outcomes, and the distinction is
 * the whole point:
 *
 *   - the goal matches a hand-authored sequence in lib/stack-templates.ts, so
 *     we return that, tagged `source: "template"` so nothing claims we analysed
 *     this particular goal
 *   - it matches nothing, so there is NO stack
 *
 * The second case is not laziness. There is no honest deterministic way to
 * split an ARBITRARY goal into stages, and inventing one would be exactly the
 * false precision the product brief warns against. A curated sequence for a
 * goal family a human actually wrote out is a different thing from a guess.
 */

import { z } from "zod"
import { parseStructured, isAIConfigured } from "./ai-provider"
import { retrieveCandidates } from "./retrieval"
import { comparableMonthly } from "./pricing-display"
import { matchTemplate } from "./stack-templates"
import { logger } from "./logger"
import type { RecommendableTool } from "./recommend"

/** Hard cap on steps. A stack a user cannot hold in their head is not a plan,
 *  and every step costs one retrieval round trip. */
const MAX_STEPS = 5

/** Candidates fetched per step. Small on purpose: the step query is narrow, so
 *  the answer is at the top or not there at all. Also keeps the per-step
 *  pricing enrichment a single bounded lookup. */
const CANDIDATES_PER_STEP = 8

/** Tokens shorter than this carry no signal for the relevance floor below
 *  ("to", "and", "for", "my"). */
const MIN_TOKEN_LENGTH = 4

/**
 * Words that are long enough to look meaningful but match almost every row in
 * THIS corpus, so they cannot support a relevance floor.
 *
 * Measured: the floor originally accepted "awesome-ai-agents-2026" for the
 * stage query "zzqqxx nonexistent tool category", because the word "tool"
 * appears in that row's description — as it does in most descriptions in a
 * directory of AI tools. A floor that any AI tool clears is not a floor.
 */
const DOMAIN_STOPWORDS = new Set([
    "tool", "tools", "software", "platform", "platforms", "service", "services",
    "category", "categories", "solution", "solutions", "product", "products",
    "online", "free", "best", "with", "your", "that", "this", "from", "into",
    "using", "make", "generate", "create", "based", "powered", "artificial",
    "intelligence",
])

/**
 * Does this candidate have ANY lexical connection to the stage it would fill?
 *
 * WHY THIS IS NECESSARY: retrieval never returns an empty result. The breadth
 * tier in search_tools_advanced ORs the query's tokens, so something always
 * matches — measured directly, the stage query "zzqqxx nonexistent tool
 * category" returned "Zeroentropy", a translation tool. Without a floor, a bad
 * decomposition stage gets silently filled with an unrelated product and the UI
 * presents it as a required part of the user's plan, complete with a price.
 *
 * An unfilled stage is the honest outcome there, and the panel says so.
 *
 * Deliberately LEXICAL and deliberately loose: one shared token of four or more
 * characters. It is a floor against nonsense, not a relevance ranking — the
 * same reasoning as the eval's keyword check, which exists to catch
 * catastrophic misses rather than to grade nuance.
 */
function hasMinimalRelevance(tool: RecommendableTool, searchQuery: string): boolean {
    const queryTokens = searchQuery
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(t => t.length >= MIN_TOKEN_LENGTH && !DOMAIN_STOPWORDS.has(t))

    // No usable tokens means we cannot judge, so do not block the candidate.
    if (queryTokens.length === 0) return true

    const haystack = `${tool.name} ${tool.category} ${tool.description} ${tool.tags.join(" ")}`.toLowerCase()
    return queryTokens.some(token => haystack.includes(token))
}

/** Decomposition budget. Sized like the recommendation reasoning call, which
 *  measured p50 ~850ms on gemini-2.5-flash. */
const DECOMPOSE_TIMEOUT_MS = 12_000

const DECOMPOSE_SYSTEM_PROMPT = `You break a user's goal into the minimum sequence of distinct stages needed to accomplish it, so each stage can be matched to a different software tool.

Rules:
- Between 2 and 5 stages. Fewer is better. If the goal genuinely needs only one tool, return exactly one stage.
- Each stage must be a DIFFERENT kind of work. Never split one kind of work into two stages.
- Order the stages in the sequence someone would actually do them.
- searchQuery must be a short, plain description of the CATEGORY OF TOOL for that stage (e.g. "transcribe audio to text", "schedule social media posts"). It must not mention the user's specific subject matter, and must not name a product.
- Set feasible to false if the goal is not something software tools accomplish (e.g. "become a better manager"), or is too vague to decompose.`

const DecompositionSchema = z.object({
    feasible: z.boolean(),
    /** Present only when feasible is false, so the UI can say something true
     *  rather than showing an empty stack. */
    reason: z.string().nullish(),
    steps: z.array(
        z.object({
            role: z.string(),
            purpose: z.string(),
            searchQuery: z.string(),
        })
    ),
})

export interface StackStep {
    order: number
    /** Short label for the stage, e.g. "Transcription". */
    role: string
    /** One sentence on why this stage exists in this goal. */
    purpose: string
    /** The retrieval query used, exposed so a wrong pick is debuggable without
     *  re-running the model call. */
    searchQuery: string
    tool: RecommendableTool | null
    /**
     * Set when this stage's best candidate was already chosen for an earlier
     * stage. The stage is NOT filled with a second-best tool: one tool covering
     * two stages is a cheaper, better stack, and hiding that to make the list
     * look fuller would misrepresent what the user needs to buy.
     */
    coveredByStep?: number
}

export interface Stack {
    goal: string
    steps: StackStep[]
    /**
     * Where the STAGES came from — the tools are always retrieved the same way.
     *
     *   "model"     the goal was analysed for this request
     *   "template"  the goal matched a hand-authored sequence in
     *               lib/stack-templates.ts, used when the model is unavailable
     *   "none"      no stages, see `message`
     *
     * Surfaced to the UI on purpose. A template is a sound answer for a goal we
     * recognise, but presenting it as analysis of THIS user's specific goal
     * would be a claim we cannot support.
     */
    source: "model" | "template" | "none"
    /** Sum of the cheapest monthly tier across DISTINCT tools that have a
     *  comparable price. Tools priced by usage or quote are excluded and
     *  counted in unpricedToolCount instead — never treated as free. */
    monthlyCostMin: number
    distinctToolCount: number
    pricedToolCount: number
    unpricedToolCount: number
    /** true when no model call was available, in which case steps is empty. */
    degraded: boolean
    message?: string
}

/** Decompose the goal into stages. Returns null on any model failure, matching
 *  the parseStructured contract used everywhere else in this codebase. */
async function decomposeGoal(goal: string) {
    if (!isAIConfigured()) {
        logger.warn("[Stack] No AI provider configured — cannot decompose a goal.")
        return null
    }

    const parsed = await parseStructured(
        DecompositionSchema,
        `User's goal: "${goal}"

Break this into the stages needed to accomplish it.`,
        {
            timeoutMs: DECOMPOSE_TIMEOUT_MS,
            system: DECOMPOSE_SYSTEM_PROMPT,
            label: "decomposeGoal",
        }
    )

    if (!parsed) return null

    // Enforce the cap in code as well as in the prompt. Gemini's schema
    // translation drops array min/max constraints (see toGeminiSchema in
    // ai-provider.ts), so the model is free to return more than asked.
    return {
        ...parsed,
        steps: parsed.steps.slice(0, MAX_STEPS),
    }
}

/** A decomposed stage, before any tool has been matched to it. This is the
 *  boundary between the model-dependent half of stack building and the
 *  deterministic half. */
export interface PlannedStep {
    role: string
    purpose: string
    searchQuery: string
}

const emptyStack = (goal: string, degraded: boolean, message: string): Stack => ({
    goal,
    steps: [],
    source: "none",
    monthlyCostMin: 0,
    distinctToolCount: 0,
    pricedToolCount: 0,
    unpricedToolCount: 0,
    degraded,
    message,
})

/**
 * Build a stack for a goal.
 *
 * Never throws. Retrieval failures degrade to a step with `tool: null` rather
 * than failing the whole stack — a plan with one unfilled stage is still useful,
 * and it shows the user exactly which part we could not cover.
 */
export async function buildStack(goal: string): Promise<Stack> {
    const decomposition = await decomposeGoal(goal)

    if (decomposition?.feasible && decomposition.steps.length > 0) {
        return assembleStack(goal, decomposition.steps, "model")
    }

    // The model said this goal genuinely does not decompose. Trust that over a
    // template — it looked at the actual goal, and a keyword match did not.
    if (decomposition && !decomposition.feasible) {
        return emptyStack(
            goal,
            false,
            decomposition.reason || "This goal doesn't break down into a sequence of tools."
        )
    }

    // No model available. Fall back to a hand-authored sequence, but ONLY for a
    // goal we recognise with confidence — see the header of stack-templates.ts
    // for why that is different from guessing. An unrecognised goal still gets
    // no stack.
    const matched = matchTemplate(goal)
    if (matched) {
        logger.info(
            `[Stack] Model unavailable; using the "${matched.template.id}" template (matched on ${matched.matchedOn}).`
        )
        return assembleStack(goal, matched.template.steps, "template")
    }

    return emptyStack(
        goal,
        true,
        "Stack building is temporarily unavailable for this goal."
    )
}

/**
 * Match tools to already-decomposed stages, dedupe across stages, and total
 * the cost.
 *
 * Exported separately from buildStack because it is the ENTIRELY DETERMINISTIC
 * half of this feature — no model call — and therefore the half that can be
 * tested while the Gemini quota is exhausted. See
 * scripts/eval/stack-assembly.mjs, which drives it with fixed stages so the
 * retrieval, dedup and cost behaviour is verified independently of whether a
 * model was available to produce those stages.
 */
export async function assembleStack(
    goal: string,
    planned: PlannedStep[],
    source: "model" | "template" = "model"
): Promise<Stack> {
    const steps_ = planned.slice(0, MAX_STEPS)
    if (steps_.length === 0) {
        return emptyStack(goal, false, "This goal doesn't break down into a sequence of tools.")
    }

    // Retrieval per step, in parallel. Each step is an independent bounded
    // query, so the wall clock is one retrieval rather than N.
    const retrieved = await Promise.all(
        steps_.map(async step => {
            try {
                const { candidates } = await retrieveCandidates(step.searchQuery, CANDIDATES_PER_STEP)
                return candidates
            } catch (error) {
                logger.warn(`[Stack] Retrieval failed for step "${step.role}":`, error)
                return []
            }
        })
    )

    // Assign one tool per step, first-come. Steps are already in execution
    // order, so an earlier step gets first claim on a shared tool.
    const usedToolIds = new Map<string, number>()
    const steps: StackStep[] = steps_.map((step, i) => {
        const order = i + 1
        // Relevance floor applied BEFORE the dedup pass, so an irrelevant
        // candidate can never occupy the stage or claim a tool id.
        const candidates = retrieved[i].filter(c => hasMinimalRelevance(c, step.searchQuery))

        const pick = candidates.find(c => !usedToolIds.has(c.id)) ?? null
        if (pick) usedToolIds.set(pick.id, order)

        // Nothing new for this stage, but the stage's top candidate is already
        // in the stack — report the overlap instead of padding with a worse tool.
        const alreadyCovering = !pick && candidates.length > 0
            ? usedToolIds.get(candidates[0].id)
            : undefined

        return {
            order,
            role: step.role,
            purpose: step.purpose,
            searchQuery: step.searchQuery,
            tool: pick,
            ...(alreadyCovering ? { coveredByStep: alreadyCovering } : {}),
        }
    })

    // Cost over DISTINCT tools. A tool covering two stages is billed once —
    // summing per step would overstate what the user pays.
    const distinctTools = new Map<string, RecommendableTool>()
    for (const step of steps) {
        if (step.tool) distinctTools.set(step.tool.id, step.tool)
    }

    let monthlyCostMin = 0
    let pricedToolCount = 0
    let unpricedToolCount = 0
    for (const tool of distinctTools.values()) {
        const monthly = comparableMonthly(tool)
        if (monthly === null) {
            unpricedToolCount++
        } else {
            monthlyCostMin += monthly
            pricedToolCount++
        }
    }

    return {
        goal,
        steps,
        source,
        monthlyCostMin: Math.round(monthlyCostMin * 100) / 100,
        distinctToolCount: distinctTools.size,
        pricedToolCount,
        unpricedToolCount,
        degraded: false,
    }
}
