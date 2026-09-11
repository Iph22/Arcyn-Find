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

import { createClient } from "@supabase/supabase-js"
import { assembleStack } from "../../lib/stack"
import { STACK_TEMPLATES } from "../../lib/stack-templates"
import { priceLabelCompact } from "../../lib/pricing-display"

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials — run with --env-file=.env.local")
    process.exit(1)
}

const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * A stage query is only usable if every one of its words co-occurs in at least
 * one row — i.e. it produces an AND-match.
 *
 * search_tools_advanced computes relevance as ts_rank against the AND tsquery.
 * When there is no AND-match, that term is zero for every candidate and the
 * pick is settled by the popularity-driven breadth tier instead. This is not
 * theoretical: the stage "schedule social media posts" had no AND-match and
 * returned TweetAssist — a Chrome extension for composing tweets — in four
 * templates, and an attempt to fix it with longer, "more distinctive" wording
 * also had no AND-match and changed nothing.
 *
 * Asserting it here turns that from something you catch by reading descriptions
 * into something a test catches.
 */
async function hasAndMatch(searchQuery: string): Promise<boolean> {
    const tsquery = searchQuery
        .split(/\s+/)
        .filter(w => w.length > 2)
        .join(" & ")
    if (!tsquery) return false

    const { data, error } = await db
        .from("ai_tools")
        .select("id")
        .textSearch("fts_vector", tsquery, { config: "english" })
        .limit(1)

    // A failed probe is not a failed assertion — say so rather than guess.
    if (error) {
        console.log(`     (AND-match probe errored: ${(error.message || "").slice(0, 60)})`)
        return true
    }
    return (data ?? []).length > 0
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
        const andMatch = await hasAndMatch(step.searchQuery)
        if (!andMatch) noAndMatch++
        console.log(`     query: "${step.searchQuery}"${andMatch ? "" : "   *** NO AND-MATCH — pick is decided by popularity, not relevance ***"}`)
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
console.log(`stage queries with no AND-match: ${noAndMatch}/${total}`)
console.log("Read the desc lines — a plausible NAME on an unrelated product is the failure mode here.")
console.log("=".repeat(72))

// Reported, NOT failed. No AND-match correlates strongly with a bad pick but
// does not determine one: "email marketing campaigns and subscriber lists" has
// no AND-match and still returns Campaigner, a real email marketing tool, and
// "video editor trim and cut footage" likewise returns Latte Social. A hard
// gate here would reject queries that demonstrably work, so this is a signal to
// investigate alongside the desc lines rather than a verdict.
if (noAndMatch > 0) {
    console.log(
        `\n${noAndMatch} stage quer${noAndMatch === 1 ? "y has" : "ies have"} no AND-match — ` +
        `their pick is settled by popularity rather than relevance, so check it above before trusting it.`
    )
}

// Supabase keeps a handle open; without this the process lingers and redirected
// output never flushes. See the note in stage-query-probe.mts.
process.exit(0)
