/**
 * Shows what every template stage actually retrieves.
 *
 * A stage's `searchQuery` is the only thing standing between a hand-authored
 * plan and a wrong tool, and a bad one is invisible until you look: the
 * youtube-channel "Scripting" stage was returning a video GENERATOR rather than
 * anything that writes scripts. This prints the pick for all stages across all
 * templates in one pass, so stage queries get fixed from the full picture
 * instead of whichever one happened to be noticed.
 *
 * Runs the real pipeline (assembleStack), so the relevance floor and the
 * cross-stage dedup are exercised exactly as they are in production.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/eval/stack-stages.mts
 *
 * --env-file is required: lib/supabase.ts reads process.env at module scope, so
 * a dotenv call inside this file would run too late. See the note in
 * stack-assembly.mts.
 */

import { assembleStack } from "../../lib/stack"
import { STACK_TEMPLATES } from "../../lib/stack-templates"
import { priceLabelCompact } from "../../lib/pricing-display"

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials — run with --env-file=.env.local")
    process.exit(1)
}

/**
 * Whether retrieval produced any keyword relevance signal for this stage.
 *
 * keyword_score is the RPC's own ts_rank against its AND tsquery, so reading
 * it is the only correct way to ask this question.
 *
 * AN EARLIER VERSION OF THIS CHECK WAS WRONG and reported 8 of 53 stages as
 * having no AND-match. It built its own tsquery by joining words with "&",
 * but the RPC uses websearch_to_tsquery, which stems and drops stopwords — so
 * the hand-rolled query was strictly stricter and invented failures. Measured
 * against the real retrieval output, every stage query has a keyword signal.
 * A probe that does not reproduce the system's own query answers a different
 * question than the one being asked.
 */
function hasKeywordSignal(candidates: { scores?: { keyword_score?: number } }[]): boolean {
    return candidates.some(c => (c.scores?.keyword_score ?? 0) > 0)
}

let unfilled = 0
let total = 0
let noAndMatch = 0

for (const template of STACK_TEMPLATES) {
    const stack = await assembleStack(template.id, template.steps, "template")

    console.log(`\n### ${template.id}  —  from $${stack.monthlyCostMin}/mo`)
    for (const step of stack.steps) {
        total++
        const pick = step.tool
            ? `${step.tool.name}  [${step.tool.category}]  ${priceLabelCompact(step.tool)}`
            : step.coveredByStep
                ? `(covered by step ${step.coveredByStep})`
                : "*** NOTHING PASSED THE RELEVANCE FLOOR ***"
        if (!step.tool) unfilled++

        console.log(`  ${step.order}. ${step.role.padEnd(15)} ${pick}`)
        const signal = step.tool ? hasKeywordSignal([step.tool]) : true
        if (!signal) noAndMatch++
        console.log(`     query: "${step.searchQuery}"${signal ? "" : "   *** no keyword signal — pick is decided by popularity ***"}`)
        if (step.tool) {
            // The description is what decides whether the pick is right, and a
            // name alone hides a mismatch (see "Vidu AI Video Generator" filling
            // a scripting stage).
            console.log(`     desc:  ${String(step.tool.description).slice(0, 110)}`)
        }
    }
}

console.log("\n" + "=".repeat(72))
console.log(`${total - unfilled}/${total} stages filled across ${STACK_TEMPLATES.length} templates`)
console.log(`stage picks with no keyword signal: ${noAndMatch}/${total}`)
console.log("Read the desc lines — a plausible NAME on an unrelated product is the failure mode here.")
console.log("=".repeat(72))

// Reported, NOT failed — and expected to be 0. Every stage query measured so
// far does produce a keyword signal; a non-zero count here would mean a stage
// whose pick was settled by popularity alone, which is worth looking at but is
// not on its own proof the pick is wrong.
if (noAndMatch > 0) {
    console.log(
        `\n${noAndMatch} stage pick${noAndMatch === 1 ? "" : "s"} had no keyword signal — ` +
        `settled by popularity rather than relevance, so check them above before trusting them.`
    )
}

// Supabase keeps a handle open; without this the process lingers and redirected
// output never flushes. See the note in stage-query-probe.mts.
process.exit(0)
