/**
 * Are duplicate rows reaching the ranked candidate set, or does the query-time
 * dedup absorb them?
 *
 * Context: 55% of the 5000 most-viewed rows are redundant duplicates of the
 * same products (tensorflow x356, Langflow x290). search_tools_advanced applies
 * DISTINCT ON (normalized name) BEFORE its final LIMIT, so the rows it RETURNS
 * should already be distinct — this checks that claim, and reports how much
 * distinct choice ranking actually gets.
 *
 * The cost of duplication is upstream of what this can see: the candidate tiers
 * fill their pools (text 240, vector 120) BEFORE dedup, so duplicates consume
 * pool slots. This measures the surviving diversity, which is the lower bound
 * on the problem.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/eval/pool-diversity.mts
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { retrieveCandidates } from "../../lib/retrieval"

const HERE = dirname(fileURLToPath(import.meta.url))
const queries: string[] = JSON.parse(readFileSync(join(HERE, "labels.json"), "utf8"))
    .labels.map((l: { query: string }) => l.query)

const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "")

let totalRows = 0
let totalDistinct = 0
let worst = { query: "", ratio: 1, rows: 0, distinct: 0 }

for (const q of queries) {
    const { candidates } = await retrieveCandidates(q, 30)
    if (candidates.length === 0) continue
    const distinct = new Set(candidates.map(c => normalize(c.name))).size
    totalRows += candidates.length
    totalDistinct += distinct
    const ratio = distinct / candidates.length
    if (ratio < worst.ratio) worst = { query: q, ratio, rows: candidates.length, distinct }
    if (ratio < 1) {
        console.log(`  ${distinct}/${candidates.length} distinct  "${q}"`)
    }
}

console.log(`\nAcross ${queries.length} queries: ${totalDistinct}/${totalRows} returned candidates are distinct products`)
console.log(`(${Math.round((totalDistinct / totalRows) * 100)}%)`)
if (worst.query) {
    console.log(`Worst: ${worst.distinct}/${worst.rows} on "${worst.query}"`)
} else {
    console.log("Every query returned fully distinct candidates — the query-time dedup is holding.")
}
process.exit(0)
