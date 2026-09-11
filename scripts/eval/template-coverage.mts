/**
 * How much of REAL user demand do the hand-authored stack templates cover?
 *
 * Phase 3's headline capability is "move beyond individual tools" for any goal,
 * and that needs the model. While the quota is exhausted, only goals matching
 * one of the 12 templates in lib/stack-templates.ts get a stack at all — so the
 * size of that gap is the practical completion gap.
 *
 * Measured against search_cache, which holds queries real users actually ran,
 * rather than against invented examples. Two caveats stated plainly: the cache
 * is whatever has been searched so far and may not represent future demand, and
 * many entries are single-tool lookups ("notion ai") that SHOULD NOT produce a
 * stack — a stack for "notion ai" would be invented work, so those are counted
 * separately rather than as misses.
 *
 * Usage: npx tsx --env-file=.env.local scripts/eval/template-coverage.mts
 */

import { getSupabaseAdmin } from "../../lib/supabase"
import { matchTemplate } from "../../lib/stack-templates"

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials — run with --env-file=.env.local")
    process.exit(1)
}

/**
 * Excludes this development session's own traffic.
 *
 * The first run of this script did not, and its answer was worthless: the
 * "uncovered real demand" it reported was dominated by the eval queries and
 * template STAGE queries this project runs against itself. A cache that records
 * every query the test suite makes is not a record of user demand unless you
 * filter the tests out.
 */
const SESSION_START = "2026-09-10T00:00:00Z"

const { data, error } = await getSupabaseAdmin()
    .from("search_cache")
    .select("query_text")
    .lt("created_at", SESSION_START)
    .order("last_used_at", { ascending: false })
    .limit(500)

if (error) {
    console.error(`search_cache read failed: ${error.message}`)
    process.exit(1)
}

const queries = (data ?? []).map(r => String(r.query_text || "")).filter(Boolean)

/** A goal is stack-SHAPED if it describes something to accomplish rather than a
 *  product to look up. Crude but explicit: multiple words, and at least one
 *  verb-ish or intent word. A single product name is not a goal. */
const GOAL_HINTS = /\b(build|make|create|launch|start|run|write|produce|grow|automate|plan|manage|sell|teach|learn|edit|design|find|turn|help|need|want|set up|how)\b/i

let goalShaped = 0
let matched = 0
const unmatchedExamples: string[] = []

for (const q of queries) {
    const isGoal = q.trim().split(/\s+/).length >= 3 && GOAL_HINTS.test(q)
    if (!isGoal) continue
    goalShaped++

    if (matchTemplate(q)) matched++
    else if (unmatchedExamples.length < 15) unmatchedExamples.push(q)
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${Math.round((n / d) * 100)}%`)

console.log(`Real queries in search_cache:       ${queries.length}`)
console.log(`Goal-shaped (would want a stack):   ${goalShaped}  (${pct(goalShaped, queries.length)})`)
console.log(`  of those, a template matches:     ${matched}  (${pct(matched, goalShaped)})`)
console.log(`  of those, need the model:         ${goalShaped - matched}  (${pct(goalShaped - matched, goalShaped)})`)
console.log(`Not goal-shaped (a stack would be invented work): ${queries.length - goalShaped}`)

if (unmatchedExamples.length > 0) {
    console.log(`\nGoal-shaped queries no template covers — these get nothing today:`)
    unmatchedExamples.forEach(q => console.log(`  "${q}"`))
}
