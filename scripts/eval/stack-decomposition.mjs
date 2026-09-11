/**
 * Exercises the MODEL decomposition path of /api/stack.
 *
 * This is the one part of Phase 3 that shipped unverified. Goal decomposition
 * needs a model call, the Gemini generation quota was exhausted for the whole
 * of its development, and the hand-authored templates in lib/stack-templates.ts
 * existed precisely so the feature was not dark in the meantime. So every stack
 * anyone had seen came from a template; whether the model picks sensible stages,
 * in a sensible order, with retrieval-friendly stage queries, was unknown.
 *
 * Three things worth separating, because they fail differently:
 *
 *   novel        goals with NO template. Only the model can answer these, so
 *                this is the actual new capability.
 *   overlapping  goals a template also covers, so model and template output can
 *                be compared on the same goal.
 *   refusals     goals that are not software-shaped. The model is asked to set
 *                feasible=false; inventing stages for these is the failure mode
 *                the whole design guards against.
 *
 * Judged by reading, not scored: there is no ground truth for "the right stages
 * for launching a food truck". The check is whether a human would act on it.
 *
 * Usage: node scripts/eval/stack-decomposition.mjs [baseUrl]
 */

const BASE_URL = process.argv[2] || "http://localhost:3000"

const CASES = [
    // Novel — no template covers these, so the model is the only path.
    { kind: "novel", goal: "run a book club with my friends" },
    { kind: "novel", goal: "plan and document a home renovation" },
    { kind: "novel", goal: "prepare a research grant application" },
    { kind: "novel", goal: "produce an audiobook from my manuscript" },
    { kind: "novel", goal: "run a small charity fundraiser" },

    // Overlapping — a template exists, so compare the model against it.
    { kind: "overlapping", goal: "launch a podcast" },
    { kind: "overlapping", goal: "set up an online store" },

    // Should refuse: not something software accomplishes, or too vague.
    { kind: "refusal", goal: "become a better manager" },
    { kind: "refusal", goal: "be happier" },
    { kind: "refusal", goal: "stuff" },
]

const post = async goal => {
    const started = Date.now()
    const res = await fetch(`${BASE_URL}/api/stack?fresh=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
        signal: AbortSignal.timeout(120_000),
    })
    const body = await res.json().catch(() => null)
    return { ms: Date.now() - started, status: res.status, body }
}

const counts = { model: 0, template: 0, none: 0 }
const latencies = []

for (const { kind, goal } of CASES) {
    const { ms, status, body } = await post(goal)
    if (!body) {
        console.log(`\n[${kind}] "${goal}" → HTTP ${status}, no body`)
        continue
    }

    counts[body.source] = (counts[body.source] ?? 0) + 1
    latencies.push(ms)

    console.log(`\n[${kind}] "${goal}"`)
    console.log(`  source=${body.source} ${ms}ms${body.steps?.length ? `  from $${body.monthlyCostMin}/mo` : ""}`)
    if (body.message) console.log(`  message: ${body.message}`)

    for (const step of body.steps ?? []) {
        const tool = step.tool
            ? step.tool.name
            : step.coveredByStep
                ? `(covered by step ${step.coveredByStep})`
                : "(nothing passed the relevance floor)"
        console.log(`  ${step.order}. ${String(step.role).padEnd(16)} ${tool}`)
        console.log(`     query: "${step.searchQuery}"`)
    }
}

const sorted = latencies.sort((a, b) => a - b)
console.log("\n" + "=".repeat(70))
console.log(`sources: model ${counts.model}, template ${counts.template}, none ${counts.none}`)
console.log(`latency p50 ${sorted[Math.floor(sorted.length / 2)] ?? 0}ms, max ${sorted[sorted.length - 1] ?? 0}ms`)
console.log("Read the stages — the question is whether a human would act on them.")
console.log("=".repeat(70))
