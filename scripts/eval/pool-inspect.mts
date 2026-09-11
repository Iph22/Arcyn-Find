/**
 * Prints the full candidate pool for one query, to answer "is the right tool
 * even in here?" — which separates a RANKING problem from a RETRIEVAL problem.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/eval/pool-inspect.mts "schedule social media posts" SocialBee Publer
 *
 * Any arguments after the query are names to look for specifically.
 */

import { retrieveCandidates } from "../../lib/retrieval"

const [query, ...lookFor] = process.argv.slice(2)
if (!query) {
    console.error('Pass a query, e.g. "schedule social media posts"')
    process.exit(1)
}

const { candidates, source } = await retrieveCandidates(query, 30)
console.log(`"${query}"  (${source}, ${candidates.length} candidates)\n`)

candidates.forEach((c, i) => {
    console.log(
        `  ${String(i + 1).padStart(2)}. ${String(c.name).slice(0, 30).padEnd(32)} ` +
        `sql=${(c.scores?.combined_score ?? 0).toFixed(2)} ` +
        `kw=${(c.scores?.keyword_score ?? 0).toFixed(2)} ` +
        `vec=${(c.scores?.vector_score ?? 0).toFixed(2)} ` +
        `pop=${c.popularity}`
    )
})

if (lookFor.length > 0) {
    console.log("\nLooking for:")
    for (const name of lookFor) {
        const at = candidates.findIndex(c => c.name.toLowerCase().includes(name.toLowerCase()))
        console.log(`  ${name.padEnd(16)} ${at === -1 ? "NOT IN POOL — retrieval never offered it" : `at position ${at + 1}`}`)
    }
}
process.exit(0)
