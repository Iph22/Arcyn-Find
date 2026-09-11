/**
 * Tests the template matcher.
 *
 * This function decides when we are confident enough to answer at all, so BOTH
 * directions are failures: matching the wrong family gives a user a plan for
 * someone else's goal, and matching nothing when we have a good sequence leaves
 * a working feature dark.
 *
 * Pure function, no network, no model, no database — so unlike the rest of the
 * stack work this runs regardless of quota.
 *
 * Run with:  npx tsx scripts/eval/stack-templates.mts
 */

import { matchTemplate, STACK_TEMPLATES } from "../../lib/stack-templates"

interface Case {
    goal: string
    /** Template id expected, or null for "must not match anything". */
    expect: string | null
}

const CASES: Case[] = [
    // Phrase hits
    { goal: "launch a podcast", expect: "podcast" },
    { goal: "I want to start a podcast about history", expect: "podcast" },
    { goal: "start a youtube channel about cooking", expect: "youtube-channel" },
    { goal: "write and publish a newsletter", expect: "newsletter" },
    { goal: "build a website without coding", expect: "website" },
    { goal: "set up an online store", expect: "online-store" },
    { goal: "create an online course", expect: "online-course" },
    { goal: "write blog posts for my company", expect: "blog-seo" },
    { goal: "grow my instagram", expect: "social-presence" },
    { goal: "build a saas product", expect: "saas-mvp" },
    { goal: "automate customer support", expect: "customer-support" },
    { goal: "do a literature review", expect: "research" },

    // Token hits (no phrase present)
    { goal: "I need help with subscribers and issues", expect: "newsletter" },
    { goal: "screening resumes from applicants", expect: "hiring" },

    // Must NOT match — these are the cases that protect users from getting a
    // plan built for a goal they did not state.
    { goal: "become a better manager", expect: null },
    { goal: "what is the best ai tool", expect: null },
    { goal: "hello", expect: null },
    { goal: "", expect: null },
    { goal: "remove the background from images", expect: null },
    { goal: "translate my documents", expect: null },
    // Single weak token only — "video" alone must not pull in a whole
    // youtube-channel plan.
    { goal: "video", expect: null },
    { goal: "email", expect: null },
]

let failures = 0

for (const c of CASES) {
    const result = matchTemplate(c.goal)
    const got = result?.template.id ?? null
    const ok = got === c.expect

    if (!ok) failures++
    console.log(
        `  ${ok ? "ok  " : "FAIL"}  ${JSON.stringify(c.goal).padEnd(46)} ` +
        `expected=${String(c.expect).padEnd(18)} got=${String(got).padEnd(18)}` +
        `${result ? ` (score ${result.score} on ${result.matchedOn})` : ""}`
    )
}

// Every template must be reachable. An unreachable template is dead weight
// that looks like coverage.
const reachable = new Set(
    CASES.map(c => matchTemplate(c.goal)?.template.id).filter(Boolean) as string[]
)
const unreachable = STACK_TEMPLATES.map(t => t.id).filter(id => !reachable.has(id))
if (unreachable.length > 0) {
    console.log(`\n  FAIL  templates never matched by any test case: ${unreachable.join(", ")}`)
    failures++
}

// Every stage must have a searchQuery that can survive the relevance floor in
// lib/stack.ts — i.e. at least one token of 4+ chars that is not a domain
// stopword. A stage whose query is all generic words can never fill.
const GENERIC = new Set([
    "tool", "tools", "software", "platform", "platforms", "service", "services",
    "category", "categories", "solution", "solutions", "product", "products",
    "online", "free", "best", "with", "your", "that", "this", "from", "into",
    "using", "make", "generate", "create", "based", "powered", "artificial",
    "intelligence",
])
for (const template of STACK_TEMPLATES) {
    for (const step of template.steps) {
        const usable = step.searchQuery
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(t => t.length >= 4 && !GENERIC.has(t))
        if (usable.length === 0) {
            console.log(
                `\n  FAIL  ${template.id} / "${step.role}": searchQuery "${step.searchQuery}" ` +
                `has no token that survives the relevance floor, so this stage can never fill`
            )
            failures++
        }
    }
}

console.log("\n" + "=".repeat(72))
console.log(
    failures === 0
        ? `PASS — ${CASES.length} matcher cases, ${STACK_TEMPLATES.length} templates all reachable and usable.`
        : `FAIL — ${failures} problem(s).`
)
console.log("=".repeat(72))
if (failures > 0) process.exitCode = 1
