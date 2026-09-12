/**
 * Reports what fraction of tools have an embedding, broken down by popularity.
 *
 * This is the headline metric for the backfill. The semantic tier of
 * search_tools_advanced requires `embedding IS NOT NULL`, so coverage is a hard
 * ceiling on how much of the catalog can be found by meaning rather than by
 * keyword. It was 11% when first measured, which is why a search for "schedule
 * social media posts" surfaced a tweeting browser extension while SocialBee
 * (popularity 100) was unreachable.
 *
 * TWO THINGS THIS DELIBERATELY AVOIDS, both learned by getting them wrong:
 *
 *  1. It never SELECTS the embedding column. 1000 rows x 768 floats is a
 *     multi-megabyte payload; the first version did that and began timing out
 *     as coverage improved — the measurement broke the better the job worked.
 *
 *  2. It never ORDERs by popularity. That query degraded to ~9s (from 2828ms)
 *     over a day of backfilling, at every LIMIT, which is the signature of the
 *     planner abandoning the index for a full scan and sort. Counting within
 *     `popularity >= n` bands is an indexed predicate and stays fast.
 *
 * Reporting per band is also just more useful than one number: coverage of the
 * tools people actually see is what affects search, and the long tail — where
 * 55% of the corpus is duplicate re-ingests — matters much less.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/eval/embedding-coverage.mts
 */

import { getSupabaseAdmin } from "../../lib/supabase"

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials — run with --env-file=.env.local")
    process.exit(1)
}

const db = getSupabaseAdmin()

/** Matches the bands the backfill works through, so the two line up. */
const BANDS = [100, 80, 60, 40, 20]

const countIn = async (floor: number, missingOnly: boolean) => {
    let q = db.from("ai_tools").select("id", { count: "exact", head: true }).gte("popularity", floor)
    if (missingOnly) q = q.is("embedding", null)
    const { count, error } = await q
    if (error) return null
    return count ?? 0
}

console.log("Embedding coverage by popularity band\n")
console.log("  band            total   have   missing   coverage")

for (const floor of BANDS) {
    const total = await countIn(floor, false)
    const missing = await countIn(floor, true)

    if (total === null || missing === null) {
        console.log(`  popularity >= ${String(floor).padEnd(4)} (count query failed — likely a statement timeout)`)
        continue
    }

    const have = total - missing
    const pct = total === 0 ? 0 : Math.round((have / total) * 100)
    console.log(
        `  popularity >= ${String(floor).padEnd(4)} ${String(total).padStart(6)} ${String(have).padStart(6)} ` +
        `${String(missing).padStart(9)}   ${String(pct).padStart(3)}%`
    )
}

console.log(`\nBands are cumulative (">= 80" includes the ">= 100" rows).`)
console.log(`The semantic tier can only see the covered portion; everything else is`)
console.log(`keyword-only and scores as "unknown" similarity in ranking.`)

process.exit(0)
