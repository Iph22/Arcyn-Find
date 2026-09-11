/**
 * Compares candidate stage queries THROUGH THE REAL PIPELINE.
 *
 * WHY THIS EXISTS: tuning stage queries against a direct FTS probe does not
 * work, and I got that wrong twice. A probe that runs the AND tsquery with
 * `ORDER BY priority, popularity` predicted "social media scheduling and
 * analytics" would return AI Engager or SocialBee — both genuine schedulers.
 * Through the actual pipeline it returned TwoSlash, a browser ChatGPT
 * extension, because search_tools_advanced also unions the breadth tiers,
 * re-ranks on combined_score, then applies the relevance floor and cross-stage
 * dedup in lib/stack.ts.
 *
 * So: only ever choose a stage query by what assembleStack actually picks.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/eval/stage-query-probe.mts "query one" "query two" ...
 */

import { assembleStack } from "../../lib/stack"

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials — run with --env-file=.env.local")
    process.exit(1)
}

const queries = process.argv.slice(2)
if (queries.length === 0) {
    console.error('Pass one or more candidate queries, e.g. "social media scheduling"')
    process.exit(1)
}

for (const q of queries) {
    // One stage per call, so nothing is removed by cross-stage dedup.
    const stack = await assembleStack("probe", [{ role: "Probe", purpose: "probe", searchQuery: q }])
    const step = stack.steps[0]
    console.log(`\n"${q}"`)
    if (!step?.tool) {
        console.log("   -> nothing passed the relevance floor")
        continue
    }
    console.log(`   -> ${step.tool.name}  [${step.tool.category}]`)
    console.log(`      ${String(step.tool.description).slice(0, 130)}`)
}

// Explicit exit: the Supabase client keeps a handle open, so without this the
// process lingers after the loop and, when stdout is redirected, the buffered
// output never flushes — the first run of this script looked like a hang and
// produced no output at all.
process.exit(0)
