/**
 * Verifies the embed-on-second-sighting behaviour in lib/embeddings.ts.
 *
 * The claim under test: a brand-new query is served WITHOUT spending an
 * embedding call (retrieval falls to the FTS tier), and searching the same
 * query again upgrades it to hybrid. That trade exists because ~70% of
 * embedding spend was going to keystroke fragments — see the long note at the
 * embedding step in lib/embeddings.ts.
 *
 * Uses a unique query per run so the first call is genuinely a first sighting.
 *
 * Usage: npx tsx --env-file=.env.local scripts/eval/lazy-embedding-check.mts
 */

import { retrieveCandidates } from "../../lib/retrieval"
import { getSupabaseAdmin } from "../../lib/supabase"

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials — run with --env-file=.env.local")
    process.exit(1)
}

const unique = `zzq test query ${Date.now()} video editing`
console.log(`query: "${unique}"\n`)

const first = await retrieveCandidates(unique, 10)
console.log(`1st search: source=${first.source}  candidates=${first.candidates.length}`)

const db = getSupabaseAdmin()
const { data: afterFirst } = await db
    .from("search_cache")
    .select("query_text, semantic_embedding")
    .eq("query_text", unique.toLowerCase().trim())
    .maybeSingle()

console.log(`  row recorded: ${afterFirst ? "yes" : "NO"}`)
console.log(`  embedding stored: ${afterFirst?.semantic_embedding ? "yes (unexpected)" : "no (expected)"}`)

const second = await retrieveCandidates(unique, 10)
console.log(`\n2nd search: source=${second.source}  candidates=${second.candidates.length}`)

const { data: afterSecond } = await db
    .from("search_cache")
    .select("semantic_embedding")
    .eq("query_text", unique.toLowerCase().trim())
    .maybeSingle()
console.log(`  embedding stored: ${afterSecond?.semantic_embedding ? "yes (expected)" : "no — quota may be exhausted"}`)

// Leave no test rows behind.
await db.from("search_cache").delete().eq("query_text", unique.toLowerCase().trim())
console.log(`\ncleaned up test row.`)

const firstOk = Boolean(afterFirst) && !afterFirst?.semantic_embedding
console.log(firstOk ? "\nPASS — first sighting spent no embedding." : "\nFAIL — see above.")
process.exitCode = firstOk ? 0 : 1
