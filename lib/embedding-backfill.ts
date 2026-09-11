/**
 * Fills in missing tool embeddings, most-viewed first.
 *
 * WHY IT MATTERS: the semantic tier of search_tools_advanced requires
 * `embedding IS NOT NULL`, so a tool without one can never be found by meaning
 * — only by keyword. Coverage was measured at 11% of the 2000 most-viewed rows,
 * which is why "schedule social media posts" returned a tweeting browser
 * extension while SocialBee (popularity 100) sat unreachable. Every row filled
 * here is a row the vector tier can finally see.
 *
 * ONE IMPLEMENTATION, used by both the CLI script and the cron route. An
 * earlier version of the script had its own copy of the loop AND its own text
 * composition, which is the mistake this project has now made twice (the
 * pricing parser duplicated across JS and TS, the retrieval pipeline duplicated
 * across two routes).
 *
 * TEXT COMPOSITION comes from generateToolEmbedding, the same function the app
 * uses when embedding a tool at write time. That consistency is not cosmetic:
 * embeddings only compare meaningfully when the text that produced them was
 * assembled the same way, so a backfill with its own format would quietly
 * populate a slightly different vector space.
 *
 * KNOWN INCONSISTENCY: roughly 1,100 rows were backfilled before this was
 * unified, using `name — category — description — tags` truncated at 8000 chars
 * instead of the app's `name. description. Category: X. Tags: a, b` truncated at
 * 2000. Those vectors are semantically reasonable but not identical to what the
 * app would produce. Re-embedding them is cheap to do (they are simply rows to
 * process again) but needs quota, so it is left as a follow-up rather than
 * silently ignored.
 */

import { getSupabaseAdmin } from "./supabase"
import { generateToolEmbedding } from "./embeddings"
import { logger } from "./logger"

/** Page size for fetching work. 300 measured at ~5.3s for this query shape;
 *  1000 exceeds the statement timeout. */
const FETCH_PAGE = 300

/** Consecutive failures that mean the quota is gone rather than one bad row.
 *  Stopping matters: hammering an exhausted quota also starves the reasoning
 *  calls the recommendation feature depends on. */
const MAX_CONSECUTIVE_FAILURES = 8

/** Pause between embedding calls. The free tier rate-limits aggressively. */
const DELAY_MS = 120

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface BackfillOptions {
    /** Maximum rows to embed in this run. */
    limit: number
    /** Stop cleanly once this much wall-clock has elapsed. Required for the
     *  cron route, which runs under a hard serverless duration cap. */
    timeBudgetMs?: number
    /** Report only; write nothing. */
    dryRun?: boolean
}

export interface BackfillResult {
    /** Rows that needed an embedding and were attempted. */
    attempted: number
    written: number
    failed: number
    /** True when the run ended early because the quota looked exhausted. */
    quotaExhausted: boolean
    /** True when the run ended early because it ran out of time budget. */
    timedOut: boolean
    elapsedMs: number
}

/** Is this the provider refusing us, rather than a problem with the row? */
const looksLikeQuota = (message: string) => /429|quota|rate limit|exhaust|RESOURCE_EXHAUSTED/i.test(message)

export async function backfillEmbeddings(options: BackfillOptions): Promise<BackfillResult> {
    const started = Date.now()
    const { limit, timeBudgetMs, dryRun = false } = options

    const result: BackfillResult = {
        attempted: 0,
        written: 0,
        failed: 0,
        quotaExhausted: false,
        timedOut: false,
        elapsedMs: 0,
    }

    const supabase = getSupabaseAdmin()

    // Ask for exactly the rows that need work, most-popular first.
    //
    // Note it FILTERS on `embedding` rather than selecting it: 1000 rows x 768
    // floats is a multi-megabyte payload, and an earlier version that selected
    // the column got slower as coverage improved until the query timed out —
    // the script broke the better it worked. Filtering is both cheaper and
    // exact, and it means re-running needs no cursor: filled rows simply leave
    // the result set.
    const todo: { id: string; name: string; description: string | null; category: string | null; tags: string[] | null }[] = []

    while (todo.length < limit) {
        const want = Math.min(FETCH_PAGE, limit - todo.length)
        const { data, error } = await supabase
            .from("ai_tools")
            .select("id, name, description, category, tags")
            .is("embedding", null)
            .order("popularity", { ascending: false, nullsFirst: false })
            .range(todo.length, todo.length + want - 1)

        if (error) {
            logger.warn(`[EmbeddingBackfill] fetch failed: ${error.message}`)
            break
        }
        if (!data || data.length === 0) break

        todo.push(...data)
        if (data.length < want) break
    }

    result.attempted = todo.length
    if (todo.length === 0 || dryRun) {
        result.elapsedMs = Date.now() - started
        return result
    }

    let consecutiveFailures = 0

    for (const row of todo) {
        if (timeBudgetMs && Date.now() - started > timeBudgetMs) {
            result.timedOut = true
            break
        }

        try {
            const embedding = await generateToolEmbedding(
                row.name,
                row.description ?? "",
                row.category ?? undefined,
                row.tags ?? undefined
            )
            // generateToolEmbedding returns null on any failure rather than
            // throwing, so a null here is a failure, not an empty embedding.
            if (!embedding) throw new Error("embedding generation returned null")

            const { error } = await supabase.from("ai_tools").update({ embedding }).eq("id", row.id)
            if (error) throw new Error(error.message)

            result.written++
            consecutiveFailures = 0
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            result.failed++
            consecutiveFailures++
            logger.warn(`[EmbeddingBackfill] ${row.name}: ${message.slice(0, 120)}`)

            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                result.quotaExhausted = true
                break
            }
            await sleep(looksLikeQuota(message) ? 5000 : 500)
        }

        await sleep(DELAY_MS)
    }

    // A run where every attempt failed is a quota signal even if it never hit
    // MAX_CONSECUTIVE_FAILURES — a small batch (the cron route uses 25, and can
    // be called with fewer) cannot reach that threshold at all, so relying on it
    // alone would report an exhausted quota as an ordinary empty run.
    if (result.written === 0 && result.failed > 0 && result.failed === result.attempted) {
        result.quotaExhausted = true
    }

    result.elapsedMs = Date.now() - started
    return result
}
