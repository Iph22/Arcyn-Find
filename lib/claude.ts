/**
 * Shared Anthropic client for ArcynFind.
 *
 * Every generative/reasoning call in the app goes through here. Embeddings do
 * NOT — Anthropic has no embeddings API, so lib/embeddings.ts stays on Gemini
 * (see the header comment there for why that can't change without re-embedding
 * the whole corpus).
 *
 * Two hard rules are enforced in this module rather than left to each caller,
 * because both were the subject of real production incidents in this codebase:
 *
 *  1. HARD PER-CALL TIMEOUT. Every call passes an explicit timeout. A hanging
 *     (not erroring) model call previously ate an entire Vercel function
 *     budget and produced a 504 with zero results.
 *
 *  2. NO RETRIES IN THE REQUEST PATH. The SDK retries twice by default —
 *     that is wrong for a user-facing path with a hard deadline, because it
 *     silently triples worst-case latency. `maxRetries: 0` is set on the
 *     client, and callers fail fast to a deterministic fallback instead.
 */

import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import type { z } from "zod"
import { logger } from "./logger"

// Model choice: one model for every reasoning path. Effort is the dial we turn
// per task (cheap extraction vs. user-visible explanation), not model tier —
// a single model also means a single prompt-cache namespace.
export const CLAUDE_MODEL = "claude-opus-5"

/** Generous ceiling — these are all small structured outputs, and we're billed
 *  on actual usage. Set high on purpose: thinking tokens count toward
 *  max_tokens on this model, and a low cap truncates mid-thought. */
const MAX_TOKENS = 16000

export const claude = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ maxRetries: 0 })
    : null

export function isClaudeConfigured(): boolean {
    return claude !== null
}

/** Effort maps directly to cost/latency. `low` for mechanical extraction,
 *  `high` (the model default) for output a user actually reads. */
export type ClaudeEffort = "low" | "medium" | "high"

interface ParseOptions {
    /** Hard deadline in milliseconds. Required — no implicit default. */
    timeoutMs: number
    effort?: ClaudeEffort
    system?: string
    label: string
}

/**
 * Run a schema-validated structured-output call.
 *
 * Returns null on ANY failure — timeout, rate limit, refusal, schema mismatch.
 * Callers must already have a deterministic fallback for null; that contract
 * predates Claude here and is unchanged.
 */
export async function parseWithClaude<T extends z.ZodType>(
    schema: T,
    prompt: string,
    opts: ParseOptions
): Promise<z.infer<T> | null> {
    if (!claude) {
        logger.warn(`[Claude] ANTHROPIC_API_KEY is not set — skipping ${opts.label}`)
        return null
    }

    try {
        const response = await claude.messages.parse(
            {
                model: CLAUDE_MODEL,
                max_tokens: MAX_TOKENS,
                ...(opts.system ? { system: opts.system } : {}),
                messages: [{ role: "user", content: prompt }],
                output_config: {
                    format: zodOutputFormat(schema),
                    ...(opts.effort ? { effort: opts.effort } : {}),
                },
            },
            { timeout: opts.timeoutMs }
        )

        // Safety classifiers can decline with HTTP 200 — check before reading.
        if (response.stop_reason === "refusal") {
            logger.warn(`[Claude] ${opts.label} refused (${response.stop_details?.category ?? "unknown"})`)
            return null
        }

        if (!response.parsed_output) {
            logger.warn(`[Claude] ${opts.label} returned no parseable output`)
            return null
        }

        return response.parsed_output as z.infer<T>
    } catch (error) {
        // Most specific first. Every branch returns null — the point is to
        // record WHY for observability, not to recover here.
        if (error instanceof Anthropic.RateLimitError) {
            logger.warn(`[Claude] ${opts.label} rate limited`)
        } else if (error instanceof Anthropic.AuthenticationError) {
            logger.error(`[Claude] ${opts.label} failed: invalid ANTHROPIC_API_KEY`)
        } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
            logger.warn(`[Claude] ${opts.label} timed out after ${opts.timeoutMs}ms`)
        } else if (error instanceof Anthropic.APIError) {
            logger.error(`[Claude] ${opts.label} API error ${error.status}:`, error.message)
        } else {
            logger.error(`[Claude] ${opts.label} unexpected error:`, error)
        }
        return null
    }
}
