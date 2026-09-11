/**
 * Offline A/B of ranking variants, graded against scripts/eval/labels.json.
 *
 * WHY OFFLINE: the previous scoring change cost a migration round trip, a
 * deploy, two eval runs and a revert — to end up at no improvement. This runs
 * the REAL retrieval and the REAL orchestrator in-process, scores several
 * ranking variants over the same candidate pools, and grades each against the
 * labels. So variants get compared in one pass, with no migration, no dev
 * server and no model quota.
 *
 * Retrieval is done ONCE per query and shared by every variant, which is what
 * makes the comparison fair: variants differ only in how the same candidates
 * are ranked.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/eval/ranking-offline.mts
 *
 * --env-file is required; see the note in stack-assembly.mts.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { retrieveCandidates } from "../../lib/retrieval"
import { runSearchOrchestrator } from "../../lib/search-orchestrator"

const HERE = dirname(fileURLToPath(import.meta.url))

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials — run with --env-file=.env.local")
    process.exit(1)
}

// ---------------------------------------------------------------------------
// Labels (same file and same grading rules the live eval uses, so the numbers
// here are comparable to its precision@1).
// ---------------------------------------------------------------------------

interface Label {
    query: string
    acceptTools?: string[]
    rejectTools?: string[]
    requireAll?: string[]
    requireAny?: string[]
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")

const labels: Label[] = JSON.parse(readFileSync(join(HERE, "labels.json"), "utf8")).labels

interface Pick {
    name: string
    description: string
    tags: string[]
}

function grade(label: Label, best: Pick | null): { pass: boolean; why: string } {
    if (!best) return { pass: false, why: "no best match" }

    const name = norm(best.name)
    const haystack = `${best.name} ${best.description} ${(best.tags ?? []).join(" ")}`.toLowerCase()

    if ((label.rejectTools ?? []).some(t => norm(t) === name)) {
        return { pass: false, why: `rejected answer returned: ${best.name}` }
    }
    const accept = label.acceptTools ?? []
    if (accept.length > 0 && !accept.some(t => norm(t) === name)) {
        return { pass: false, why: `not in accepted set: ${best.name}` }
    }
    const missing = (label.requireAll ?? []).filter(t => !haystack.includes(t.toLowerCase()))
    if (missing.length > 0) return { pass: false, why: `missing: ${missing.join(", ")}` }

    const any = label.requireAny ?? []
    if (any.length > 0 && !any.some(t => haystack.includes(t.toLowerCase()))) {
        return { pass: false, why: `no required term matched (${best.name})` }
    }
    return { pass: true, why: "" }
}

// ---------------------------------------------------------------------------
// Ranking variants. Each maps the retrieved candidates into the orchestrator's
// input shape; the orchestrator itself is untouched.
// ---------------------------------------------------------------------------

type Retrieved = Awaited<ReturnType<typeof retrieveCandidates>>["candidates"][number]

interface Variant {
    name: string
    note: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: (c: Retrieved) => any
}

const VARIANTS: Variant[] = [
    {
        name: "current",
        note: "what /api/recommend does today — keyword/vector/trust hardcoded to 0.5",
        map: c => ({
            id: c.id,
            title: c.name,
            description: c.description,
            platform: c.platform,
            tags: c.tags,
            keyword_score: 0.5,
            vector_score: 0.5,
            popularity_score: Math.min(c.popularity / 100, 1),
            source_trust_score: 0.5,
            freshness_date: null,
            is_trending: false,
        }),
    },
    {
        name: "real-scores",
        note: "pass the scores retrieval already computed instead of constants",
        map: c => ({
            id: c.id,
            title: c.name,
            description: c.description,
            platform: c.platform,
            tags: c.tags,
            keyword_score: c.scores?.keyword_score ?? 0.5,
            vector_score: c.scores?.vector_score ?? 0.5,
            popularity_score: Math.min(c.popularity / 100, 1),
            source_trust_score: c.scores?.source_trust_score ?? 0.5,
            freshness_date: c.scores?.freshness_date ?? null,
            is_trending: c.scores?.is_trending ?? false,
        }),
    },
    {
        name: "sql-order",
        note: "skip the JS re-rank entirely — trust search_tools_advanced's combined_score",
        map: c => ({ __sqlOrder: true, id: c.id, title: c.name, description: c.description, tags: c.tags }),
    },
    {
        // Best of both, in principle: the orchestrator's hard filter drops stubs
        // and near-duplicates, which matters for the alternatives as well as the
        // top pick, but the ORDER comes from the SQL relevance score rather than
        // the JS formula.
        name: "filter+sql",
        note: "orchestrator filters the pool, SQL combined_score picks the winner",
        map: c => ({
            id: c.id,
            title: c.name,
            description: c.description,
            platform: c.platform,
            tags: c.tags,
            keyword_score: c.scores?.keyword_score ?? 0.5,
            vector_score: c.scores?.vector_score ?? 0.5,
            popularity_score: Math.min(c.popularity / 100, 1),
            source_trust_score: c.scores?.source_trust_score ?? 0.5,
            freshness_date: c.scores?.freshness_date ?? null,
            is_trending: c.scores?.is_trending ?? false,
        }),
    },
]

// ---------------------------------------------------------------------------

const results = new Map<string, { pass: number; fails: string[] }>()
for (const v of VARIANTS) results.set(v.name, { pass: 0, fails: [] })

let hybridCount = 0
let graded = 0

for (const label of labels) {
    const { candidates, source } = await retrieveCandidates(label.query, 30)
    if (source === "hybrid") hybridCount++
    if (candidates.length === 0) {
        console.log(`  (no candidates) "${label.query}"`)
        continue
    }
    graded++

    for (const variant of VARIANTS) {
        let best: Pick | null = null

        if (variant.name === "sql-order") {
            // Retrieval already returns rows in the SQL ranking order.
            const top = candidates[0]
            best = top ? { name: top.name, description: top.description, tags: top.tags } : null
        } else if (variant.name === "filter+sql") {
            // Keep only what the orchestrator kept, then order those by the SQL
            // score. combined_score is absent on the FTS tier, so fall back to
            // the retrieval order (index) for those, which is already SQL order.
            const ranked = runSearchOrchestrator(label.query, candidates.map(variant.map))
            const survivors = ranked.results
                .map(r => candidates.findIndex(c => c.id === r.id))
                .filter(i => i >= 0)
                .map(i => ({ c: candidates[i], i }))
            survivors.sort((a, z) => {
                const az = z.c.scores?.combined_score
                const aa = a.c.scores?.combined_score
                if (typeof aa === "number" && typeof az === "number" && aa !== az) return az - aa
                return a.i - z.i
            })
            const top = survivors[0]?.c ?? candidates[0]
            best = top ? { name: top.name, description: top.description, tags: top.tags } : null
        } else {
            const ranked = runSearchOrchestrator(label.query, candidates.map(variant.map))
            const topId = ranked.results[0]?.id
            const match = candidates.find(c => c.id === topId) ?? candidates[0]
            best = match ? { name: match.name, description: match.description, tags: match.tags } : null
        }

        const verdict = grade(label, best)
        const bucket = results.get(variant.name)!
        if (verdict.pass) bucket.pass++
        else bucket.fails.push(`"${label.query}" → ${verdict.why}`)
    }
}

console.log(`\nGraded ${graded} labeled queries.`)
console.log(`Retrieval mix: hybrid ${hybridCount}/${graded}, other ${graded - hybridCount}/${graded}`)
console.log("(Variants are only comparable to the live eval when hybrid dominates, as it does there.)\n")

console.log("=".repeat(72))
for (const v of VARIANTS) {
    const r = results.get(v.name)!
    const pct = graded === 0 ? 0 : Math.round((r.pass / graded) * 100)
    console.log(`${v.name.padEnd(14)} precision@1 ${String(pct).padStart(3)}%  (${r.pass}/${graded})   ${v.note}`)
}
console.log("=".repeat(72))

// The winner's remaining failures are the next thing to look at.
const best = [...results.entries()].sort((a, b) => b[1].pass - a[1].pass)[0]
console.log(`\nRemaining failures for "${best[0]}":`)
for (const f of best[1].fails) console.log(`  ${f}`)

process.exit(0)
