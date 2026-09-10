/**
 * Provider-agnostic structured-output layer for every reasoning call in the app.
 *
 * WHY THIS EXISTS: the app ran on Gemini, briefly moved to Claude, and moved
 * back to Gemini pending Anthropic credits. Rather than rewrite three call
 * sites each time, both backends live here behind one function and the choice
 * is an env var. Switching is a config flip, not a migration.
 *
 * Set AI_PROVIDER=gemini | claude to pick explicitly. If unset, whichever
 * Override the model per provider with GEMINI_MODEL / CLAUDE_MODEL.
 * API key is present wins (Gemini first, since that's the funded path today).
 *
 * NOT handled here: embeddings. Anthropic has no embeddings API, and the ~257k
 * vectors in ai_tools.embedding were produced by gemini-embedding-001 — see the
 * header in lib/embeddings.ts for why that can't be swapped without re-embedding
 * the entire corpus.
 *
 * Two rules are enforced in this module rather than trusted to callers, because
 * both caused real production incidents in this codebase:
 *
 *   1. HARD PER-CALL TIMEOUT on every request. A hanging (not erroring) model
 *      call previously consumed an entire Vercel function budget and returned
 *      a 504 with zero results.
 *   2. NO RETRIES IN THE REQUEST PATH. Retrying inside a hard deadline just
 *      multiplies worst-case latency for the same coin-flip outcome. Callers
 *      fail fast to a deterministic fallback instead.
 */

// Uses @google/genai (the current SDK), NOT @google/generative-ai. The older
// package is still a dependency because lib/embeddings.ts deliberately stays on
// it — the ~257k stored vectors were produced through that exact call path, and
// changing it risks subtly different vectors that no longer compare against the
// corpus. Only this reasoning path moved, because only the new SDK exposes
// thinkingConfig (see GEMINI_THINKING_BUDGET below).
import { GoogleGenAI } from "@google/genai"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { logger } from "./logger"

export type AIProviderName = "gemini" | "claude"

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

/**
 * Gemini: Flash tier across the board. These tasks are structured extraction,
 * re-ranking, and a few sentences of prose — the heavy lifting is done by
 * retrieval and the deterministic orchestrator, so Flash's quality is
 * sufficient and its latency matters more (every one of these calls sits
 * inside a user-facing request with a hard deadline).
 *
 * PINNED DELIBERATELY, and neither a `-preview` nor a `-latest` identifier.
 * Both of those have bitten this codebase:
 *   - preview/dated models get retired (the text-embedding-004 shutdown), and
 *   - `gemini-flash-latest` is a floating alias that can silently resolve to an
 *     overloaded model. Measured here: 11.9s for a three-word prompt, then a
 *     503 "experiencing high demand" at 64s, which timed out every reasoning
 *     call in the app. `gemini-2.5-flash` answered the same prompt in 857ms.
 * Pin it, and re-measure before changing it.
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"

/** Claude: one model for every path. Effort is the per-task dial, not tier —
 *  which also keeps a single prompt-cache namespace.
 *
 *  WORTH REVISITING: reasonWithAI is a short structured extraction that runs
 *  per search and blocks the recommendation panel, and the Gemini side of
 *  this abstraction is deliberately on the FAST tier (2.5-flash) for that
 *  reason. Opus is the strongest but not the fastest or cheapest choice for
 *  that shape of call; claude-sonnet-5 is the like-for-like counterpart to
 *  gemini-2.5-flash. Left as Opus because it has never actually run here —
 *  the account is unfunded, so both models return HTTP 400 "credit balance
 *  is too low" — and picking a tier on latency grounds without being able
 *  to measure it would be a guess. Override with CLAUDE_MODEL and measure. */
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5"

const CLAUDE_MAX_TOKENS = 16000
const GEMINI_MAX_OUTPUT_TOKENS = 8192

/**
 * Gemini 2.5 runs "thinking" by default, and on these tasks it is pure latency
 * with no measurable quality gain. Measured on the recommendation-reasoning
 * prompt, same model, same schema:
 *
 *     thinking default   9945ms
 *     thinkingBudget: 0  1676ms / 1272ms   <- same chosen tool, schema still valid
 *
 * That makes sense for what we actually ask of the model here: retrieval and
 * the deterministic orchestrator have already done the selection work, so every
 * call is "pick from this short list and write one sentence" — not a problem
 * that benefits from extended reasoning.
 *
 * Callers that genuinely want deliberation can pass effort: "high", which omits
 * thinkingConfig and restores the default behaviour.
 */
const GEMINI_THINKING_BUDGET_DISABLED = 0

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const geminiClient = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null

// maxRetries: 0 — the SDK retries twice by default, which would silently
// triple worst-case latency on paths we spent considerable effort bounding.
const claudeClient = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ maxRetries: 0 })
    : null

export function activeProvider(): AIProviderName | null {
    const explicit = process.env.AI_PROVIDER?.toLowerCase()
    if (explicit === "gemini") return geminiClient ? "gemini" : null
    if (explicit === "claude") return claudeClient ? "claude" : null
    if (geminiClient) return "gemini"
    if (claudeClient) return "claude"
    return null
}

export function isAIConfigured(): boolean {
    return activeProvider() !== null
}

/** Applies to Claude only — Gemini has no equivalent knob on this surface. */
export type AIEffort = "low" | "medium" | "high"

interface ParseOptions {
    /** Hard deadline in milliseconds. Required — no implicit default. */
    timeoutMs: number
    effort?: AIEffort
    system?: string
    label: string
}

/**
 * Run a schema-validated structured-output call against the active provider.
 *
 * Returns null on ANY failure: timeout, rate limit, refusal, malformed JSON, or
 * a response that doesn't satisfy the schema. Every caller already has a
 * deterministic fallback for null — that contract predates both providers.
 */
export async function parseStructured<T extends z.ZodType>(
    schema: T,
    prompt: string,
    opts: ParseOptions
): Promise<z.infer<T> | null> {
    const provider = activeProvider()

    if (!provider) {
        logger.warn(`[AI] No provider configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY) — skipping ${opts.label}`)
        return null
    }

    try {
        return provider === "gemini"
            ? await parseWithGemini(schema, prompt, opts)
            : await parseWithClaude(schema, prompt, opts)
    } catch (error) {
        logCallFailure(provider, opts, error)
        return null
    }
}

// ---------------------------------------------------------------------------
// Gemini backend
// ---------------------------------------------------------------------------

/**
 * Gemini's responseSchema accepts a JSON-Schema-shaped object, but rejects
 * several keywords that zod emits. Strip those rather than hand-maintain a
 * parallel schema per call site — Zod stays the single source of truth.
 *
 * Note this is best-effort: even if Gemini ignores or mishandles the schema,
 * the zod `safeParse` below is the actual guarantee.
 */
const GEMINI_UNSUPPORTED_KEYS = new Set([
    "$schema", "$ref", "$defs", "definitions", "additionalProperties",
    "exclusiveMinimum", "exclusiveMaximum", "const", "default",
    "patternProperties", "allOf", "oneOf", "not",
])

function toGeminiSchema(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(toGeminiSchema)
    if (node === null || typeof node !== "object") return node

    const source = node as Record<string, unknown>

    // zod's `.nullable()` emits `anyOf: [{type: X}, {type: "null"}]`. Gemini
    // expresses the same thing as `{type: X, nullable: true}` and its schema
    // type has no documented anyOf support, so translate rather than pass it
    // through and hope.
    const anyOf = source.anyOf
    if (Array.isArray(anyOf)) {
        const nonNull = anyOf.filter(
            (m): m is Record<string, unknown> =>
                !!m && typeof m === "object" && (m as Record<string, unknown>).type !== "null"
        )
        const hadNull = anyOf.length !== nonNull.length
        if (nonNull.length === 1) {
            const { anyOf: _dropped, ...rest } = source
            return toGeminiSchema({ ...nonNull[0], ...rest, ...(hadNull ? { nullable: true } : {}) })
        }
    }

    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(source)) {
        if (GEMINI_UNSUPPORTED_KEYS.has(key)) continue
        out[key] = toGeminiSchema(value)
    }
    return out
}

async function parseWithGemini<T extends z.ZodType>(
    schema: T,
    prompt: string,
    opts: ParseOptions
): Promise<z.infer<T> | null> {
    if (!geminiClient) return null

    // Thinking off unless a caller explicitly asks for deliberation — a ~7x
    // latency difference on these prompts (see GEMINI_THINKING_BUDGET_DISABLED).
    const wantsThinking = opts.effort === "high"

    // The deadline is enforced here rather than by the SDK. Losing the race
    // abandons the response instead of cancelling the upstream request, which
    // is acceptable: the alternative is blowing the whole request budget.
    const result = await withDeadline(
        geminiClient.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: toGeminiSchema(z.toJSONSchema(schema)) as any,
                maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
                ...(opts.system ? { systemInstruction: opts.system } : {}),
                ...(wantsThinking
                    ? {}
                    : { thinkingConfig: { thinkingBudget: GEMINI_THINKING_BUDGET_DISABLED } }),
            },
        }),
        opts.timeoutMs,
        opts.label
    )

    return validate(schema, result.text ?? "", opts.label)
}

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { isTimeout: true }))
        }, ms)
        promise.then(
            value => { clearTimeout(timer); resolve(value) },
            error => { clearTimeout(timer); reject(error) }
        )
    })
}

/**
 * Parse + schema-validate a JSON response.
 *
 * This replaced the previous approach of stripping markdown fences, slicing
 * between the first and last brace, and JSON.parse-ing whatever remained —
 * which could yield a wrong-shaped object that satisfied a couple of ad-hoc
 * field checks and then broke downstream. The fence-stripping is retained
 * because Gemini occasionally wraps JSON despite responseMimeType.
 */
function validate<T extends z.ZodType>(schema: T, text: string, label: string): z.infer<T> | null {
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim()

    let raw: unknown
    try {
        raw = JSON.parse(cleaned)
    } catch {
        logger.warn(`[AI] ${label} returned non-JSON output`)
        return null
    }

    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
        logger.warn(`[AI] ${label} output failed schema validation:`, parsed.error.issues.slice(0, 3))
        return null
    }
    return parsed.data
}

// ---------------------------------------------------------------------------
// Claude backend (dormant until ANTHROPIC_API_KEY is set)
// ---------------------------------------------------------------------------

async function parseWithClaude<T extends z.ZodType>(
    schema: T,
    prompt: string,
    opts: ParseOptions
): Promise<z.infer<T> | null> {
    if (!claudeClient) return null

    const response = await claudeClient.messages.parse(
        {
            model: CLAUDE_MODEL,
            max_tokens: CLAUDE_MAX_TOKENS,
            ...(opts.system ? { system: opts.system } : {}),
            messages: [{ role: "user", content: prompt }],
            output_config: {
                format: zodOutputFormat(schema),
                ...(opts.effort ? { effort: opts.effort } : {}),
            },
        },
        { timeout: opts.timeoutMs }
    )

    // Safety classifiers can decline with HTTP 200 — check before reading content.
    if (response.stop_reason === "refusal") {
        logger.warn(`[AI] ${opts.label} refused (${response.stop_details?.category ?? "unknown"})`)
        return null
    }

    if (!response.parsed_output) {
        logger.warn(`[AI] ${opts.label} returned no parseable output`)
        return null
    }

    return response.parsed_output as z.infer<T>
}

// ---------------------------------------------------------------------------
// Failure logging — every branch still returns null; this records WHY.
// ---------------------------------------------------------------------------

function logCallFailure(provider: AIProviderName, opts: ParseOptions, error: unknown) {
    const e = error as any

    if (e?.isTimeout) {
        logger.warn(`[AI:${provider}] ${opts.label} timed out after ${opts.timeoutMs}ms`)
        return
    }

    if (provider === "claude") {
        if (error instanceof Anthropic.RateLimitError) {
            logger.warn(`[AI:claude] ${opts.label} rate limited`)
        } else if (error instanceof Anthropic.AuthenticationError) {
            logger.error(`[AI:claude] ${opts.label} failed: invalid ANTHROPIC_API_KEY`)
        } else if (error instanceof Anthropic.APIError) {
            logger.error(`[AI:claude] ${opts.label} API error ${error.status}:`, error.message)
        } else {
            logger.error(`[AI:claude] ${opts.label} unexpected error:`, error)
        }
        return
    }

    // Gemini surfaces quota/availability as status codes on the thrown error.
    const status = e?.status ?? e?.response?.status
    if (status === 429) {
        logger.warn(`[AI:gemini] ${opts.label} rate limited / quota exhausted`)
    } else if (status === 503) {
        logger.warn(`[AI:gemini] ${opts.label} model unavailable`)
    } else if (status) {
        logger.error(`[AI:gemini] ${opts.label} API error ${status}:`, e?.message ?? error)
    } else {
        logger.error(`[AI:gemini] ${opts.label} unexpected error:`, e?.message ?? error)
    }
}

/** Marks an error as an AI-availability failure, so route.ts's existing cooldown
 *  logic (which backs off after 429/503) keeps working across providers. */
export function isAIUnavailableError(error: unknown): boolean {
    const e = error as any
    const status = e?.status ?? e?.response?.status
    return e?.isTimeout === true || status === 429 || status === 503 || e?.isAIUnavailable === true
}
