/**
 * Verifies the DETERMINISTIC half of stack building.
 *
 * WHY THIS EXISTS SEPARATELY: buildStack() needs a model call to split a goal
 * into stages, and the Gemini free-tier quota has been exhausted throughout
 * this work — every /api/stack call currently returns
 * `degraded: "Stack building is temporarily unavailable"`. That makes the
 * feature impossible to validate end to end, but the half that matters most
 * for correctness (per-stage retrieval, cross-stage dedup, cost arithmetic)
 * has no model dependency at all.
 *
 * So this drives assembleStack() with FIXED stages — the kind of stages a
 * working decomposition would produce — and checks the properties that must
 * hold regardless of what the model says:
 *
 *   - every stage either gets a tool, or is honestly marked unfilled/covered
 *   - no tool appears in two stages
 *   - cost is summed over DISTINCT tools, so a tool covering two stages is
 *     billed once
 *   - tools with no comparable price are counted, never treated as free
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/eval/stack-assembly.mts
 *
 * --env-file is REQUIRED and calling dotenv from inside this file does not
 * work. lib/supabase.ts reads process.env.NEXT_PUBLIC_SUPABASE_URL at module
 * scope (line 4), and ESM evaluates every static import before the first
 * statement in this file runs — so a dotenv.config() call here executes too
 * late and the Supabase client is built with undefined credentials. The first
 * version of this suite did exactly that, retrieved nothing for every step,
 * and reported PASS because all the properties held vacuously over zero
 * tools. Hence both the credentials guard and the empty-stack guard below.
 */

import { assembleStack, type PlannedStep } from "../../lib/stack"
import { comparableMonthly } from "../../lib/pricing-display"

interface Scenario {
    goal: string
    steps: PlannedStep[]
    /** false only for the scenario whose whole purpose is to match nothing.
     *  Everywhere else, an empty stack means retrieval is broken and must
     *  not be reported as a pass. */
    expectTools?: boolean
}

const SCENARIOS: Scenario[] = [
    {
        goal: "launch a podcast",
        steps: [
            { role: "Recording", purpose: "Capture the audio.", searchQuery: "record and edit audio" },
            { role: "Transcription", purpose: "Get a text transcript.", searchQuery: "transcribe audio to text" },
            { role: "Clips", purpose: "Cut short promo clips.", searchQuery: "turn long video into short clips" },
            { role: "Artwork", purpose: "Cover art for the feed.", searchQuery: "create cover art and graphics" },
            { role: "Promotion", purpose: "Post each episode.", searchQuery: "schedule social media posts" },
        ],
    },
    {
        goal: "write and publish a newsletter",
        steps: [
            { role: "Drafting", purpose: "Write the issues.", searchQuery: "ai writing assistant for articles" },
            { role: "Images", purpose: "Illustrate each issue.", searchQuery: "generate illustrations" },
            { role: "Sending", purpose: "Deliver to subscribers.", searchQuery: "email newsletter platform" },
        ],
    },
    {
        // Deliberately overlapping stages: two stages whose best tool is very
        // likely the same product. Exercises the dedup / coveredByStep path.
        goal: "make short videos from long ones",
        steps: [
            { role: "Clipping", purpose: "Find the good moments.", searchQuery: "turn long video into short clips" },
            { role: "Repurposing", purpose: "Reformat for socials.", searchQuery: "turn long video into short clips" },
        ],
    },
    {
        // Nonsense stage queries: retrieval should find nothing and the stack
        // should say so rather than inventing a tool.
        goal: "impossible stage test",
        expectTools: false,
        steps: [
            { role: "Nonsense", purpose: "Should not match.", searchQuery: "zzqqxx nonexistent tool category" },
        ],
    },
]

// Refuse to run without credentials rather than reporting a vacuous pass.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — cannot retrieve, so this suite would pass on nothing.")
    process.exit(1)
}

let failures = 0
const fail = (msg: string) => {
    console.log(`      FAIL: ${msg}`)
    failures++
}

for (const scenario of SCENARIOS) {
    const started = Date.now()
    const stack = await assembleStack(scenario.goal, scenario.steps)
    const ms = Date.now() - started

    console.log(`\n=== "${scenario.goal}"  ${ms}ms`)
    console.log(
        `    $${stack.monthlyCostMin}/mo across ${stack.distinctToolCount} tools ` +
        `(${stack.pricedToolCount} priced, ${stack.unpricedToolCount} unpriced)`
    )

    for (const step of stack.steps) {
        const label = step.tool
            ? `${step.tool.name} [${step.tool.category}] ${JSON.stringify(comparableMonthly(step.tool))}`
            : step.coveredByStep
                ? `(covered by step ${step.coveredByStep})`
                : "(nothing found)"
        console.log(`    ${step.order}. ${step.role.padEnd(16)} ${label}`)
    }

    // --- Properties that must hold ---

    if (stack.steps.length !== scenario.steps.length) {
        fail(`expected ${scenario.steps.length} steps, got ${stack.steps.length}`)
    }

    const toolIds = stack.steps.filter(s => s.tool).map(s => s.tool!.id)
    if (new Set(toolIds).size !== toolIds.length) {
        fail("the same tool was assigned to more than one step")
    }

    if (stack.distinctToolCount !== new Set(toolIds).size) {
        fail(`distinctToolCount ${stack.distinctToolCount} != ${new Set(toolIds).size} distinct tools`)
    }

    if (stack.pricedToolCount + stack.unpricedToolCount !== stack.distinctToolCount) {
        fail("priced + unpriced does not equal distinct tool count")
    }

    // Recompute the cost independently rather than trusting the module's own
    // number: sum comparableMonthly over distinct tools.
    const seen = new Map<string, number | null>()
    for (const step of stack.steps) {
        if (step.tool && !seen.has(step.tool.id)) seen.set(step.tool.id, comparableMonthly(step.tool))
    }
    const expected = [...seen.values()].reduce<number>((sum, v) => sum + (v ?? 0), 0)
    if (Math.abs(expected - stack.monthlyCostMin) > 0.011) {
        fail(`cost ${stack.monthlyCostMin} != independently computed ${Math.round(expected * 100) / 100}`)
    }

    const unpricedFromTools = [...seen.values()].filter(v => v === null).length
    if (unpricedFromTools !== stack.unpricedToolCount) {
        fail(`unpricedToolCount ${stack.unpricedToolCount} != ${unpricedFromTools} tools with no comparable price`)
    }

    if (stack.degraded) fail("assembleStack should never report degraded — it makes no model call")

    // The guard against a vacuous pass: a realistic scenario that fills no
    // step at all means retrieval is broken, not that the properties hold.
    const expectTools = scenario.expectTools !== false
    if (expectTools && toolIds.length === 0) {
        fail("no step was filled — retrieval returned nothing, so nothing was actually verified")
    }
    // Bidirectional: the nonsense scenario must fill NOTHING. Retrieval always
    // returns something (the breadth tier ORs tokens, so "zzqqxx nonexistent
    // tool category" matched a translation tool), so this asserts the relevance
    // floor in lib/stack.ts is actually rejecting it.
    if (!expectTools && toolIds.length > 0) {
        fail(`relevance floor let an unrelated tool through: ${stack.steps.find(s2 => s2.tool)?.tool?.name}`)
    }
}

console.log("\n" + "=".repeat(64))
console.log(failures === 0 ? "PASS — all stack assembly properties hold." : `FAIL — ${failures} property violation(s).`)
console.log("=".repeat(64))
if (failures > 0) process.exitCode = 1
