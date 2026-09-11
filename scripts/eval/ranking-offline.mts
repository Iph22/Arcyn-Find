/**
 * Offline A/B of ranking variants, graded against scripts/eval/labels.json.
 *
 * WHY OFFLINE: an earlier scoring change cost a migration round trip, a deploy,
 * two eval runs and a revert — to arrive at no improvement. This runs the REAL
 * retrieval and the REAL orchestrator in-process, ranks the SAME candidate pool
 * several different ways, and grades each against the labels. Variants get
 * compared in one pass with no migration, no dev server and no model quota.
 *
 * Retrieval happens ONCE per query and is shared by every variant, which is
 * what makes the comparison fair.
 *
 * Its baseline reproduced the live eval's precision@1 exactly (62% before the
 * scores were threaded through, 81% after), which is the reason to trust the
 * relative numbers it reports for untried variants.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/eval/ranking-offline.mts
 *
 * MEASURED DEAD ENDS — do not re-try these without new evidence. All graded on
 * the same 26 labeled queries, hybrid retrieval throughout, against the 81%
 * production baseline:
 *
 *     order by lexical relevance only                    73%
 *     sql/10 + 0.3 x lexical                             69%
 *     sql/10 + 0.6 x lexical                             65%
 *     sql/10 + 1.0 x lexical                             65%
 *     lexical breaks near-ties (within 0.5 of leader)    65%
 *     lexical only when no AND-match                     81%  (never fired)
 *
 * Blending a TypeScript lexical-overlap score into the ranking makes it
 * monotonically worse: search_tools_advanced already blends FTS rank with
 * vector similarity, and a crude term-overlap signal only adds noise. The last
 * variant tied the baseline because the condition never occurs — measured 0 of
 * 26 recommendation queries and 0 of 32 stack stage queries have a pool where
 * ts_rank is zero throughout, since the RPC builds its tsquery with
 * websearch_to_tsquery, which stems and drops stopwords.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { retrieveCandidates, coverageAdjustedScores } from "../../lib/retrieval"
import { runSearchOrchestrator } from "../../lib/search-orchestrator"

const HERE = dirname(fileURLToPath(import.meta.url))

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials — run with --env-file=.env.local")
    process.exit(1)
}

// ---------------------------------------------------------------------------
// Labels — same file and same grading rules as the live eval, so precision@1
// here is directly comparable to the number it prints.
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

type Candidate = Awaited<ReturnType<typeof retrieveCandidates>>["candidates"][number]

function grade(label: Label, best: Candidate | null): { pass: boolean; why: string } {
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
// Shared pieces
// ---------------------------------------------------------------------------

/** The orchestrator input shape, built from the real retrieval scores. This is
 *  what production does now. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toOrchestratorInput = (c: Candidate): any => ({
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
})

/** Candidates the orchestrator's hard filter keeps, in retrieval (SQL) order.
 *  Worth keeping regardless of how they are then ordered: it drops stubs and
 *  near-duplicates, which matters for the alternatives as much as the pick. */
function filtered(query: string, candidates: Candidate[]): Candidate[] {
    const ranked = runSearchOrchestrator(query, candidates.map(toOrchestratorInput))
    const kept = new Set(ranked.results.map(r => r.id).filter(Boolean) as string[])
    const survivors = candidates.filter(c => kept.has(c.id))
    return survivors.length > 0 ? survivors : candidates
}

const sqlScore = (c: Candidate) => c.scores?.combined_score ?? 0

/** SQL scores sit on roughly 0-10; map to 0-1 so a blend weight means something. */
const NORMALIZE_SQL_BY = 10

interface Variant {
    name: string
    note: string
    rank: (query: string, candidates: Candidate[]) => Candidate[]
}

/** The weight search_tools_advanced gives vector similarity in combined_score. */
const SIM_WEIGHT = 3.0

/** Delegates to the shared implementation so the harness measures exactly
 *  what production runs. */
function neutralizeMissingSim(_query: string, pool: Candidate[]): Candidate[] {
    const scores = coverageAdjustedScores(pool)
    return [...pool].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
}

const VARIANTS: Variant[] = [
    {
        name: "raw-sql-score",
        note: "previous: orders by combined_score as-is (missing embedding = 0 similarity)",
        rank: (q, cs) => [...filtered(q, cs)].sort((a, b) => sqlScore(b) - sqlScore(a)),
    },
    {
        // Does the vector tier help at all, at the embedding quality we have?
        // Embeddings are built from name+category+description+tags, so cosine
        // similarity to a goal query rewards surface wording — a tool literally
        // called "AI Email Writer" looks near to "write cold outreach emails"
        // whether or not it does sales outreach.
        name: "no-sim",
        note: "remove the vector term entirely (sql score minus 3 x sim)",
        rank: (q, cs) =>
            [...filtered(q, cs)].sort(
                (a, b) =>
                    sqlScore(b) - SIM_WEIGHT * (b.scores?.vector_score ?? 0) -
                    (sqlScore(a) - SIM_WEIGHT * (a.scores?.vector_score ?? 0))
            ),
    },
    {
        name: "production",
        note: "current: orchestrator filters, coverage-adjusted score orders",
        rank: (q, cs) => neutralizeMissingSim(q, filtered(q, cs)),
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
        const ordered = variant.rank(label.query, candidates)
        const verdict = grade(label, ordered[0] ?? null)
        const bucket = results.get(variant.name)!
        if (verdict.pass) bucket.pass++
        else bucket.fails.push(`"${label.query}" → ${verdict.why}`)
    }
}

console.log(`\nGraded ${graded} labeled queries.`)
console.log(`Retrieval mix: hybrid ${hybridCount}/${graded}, other ${graded - hybridCount}/${graded}\n`)

console.log("=".repeat(78))
const ranking = [...results.entries()].sort((a, b) => b[1].pass - a[1].pass)
for (const v of VARIANTS) {
    const r = results.get(v.name)!
    const pct = graded === 0 ? 0 : Math.round((r.pass / graded) * 100)
    const marker = ranking[0][0] === v.name ? " <-- best" : ""
    console.log(`${v.name.padEnd(18)} ${String(pct).padStart(3)}%  (${r.pass}/${graded})  ${v.note}${marker}`)
}
console.log("=".repeat(78))

console.log(`\nRemaining failures for "${ranking[0][0]}":`)
for (const f of ranking[0][1].fails) console.log(`  ${f}`)

process.exit(0)
