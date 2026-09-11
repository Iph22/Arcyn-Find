/**
 * CLI wrapper over lib/embedding-backfill.ts.
 *
 * Thin on purpose: the loop, the text composition, the quota handling and the
 * query shape all live in the lib so that this and
 * /api/cron/backfill-embeddings cannot drift apart. An earlier version of this
 * script had its own copy of all of it — including a DIFFERENT text
 * composition, which quietly produced embeddings in a slightly different vector
 * space than the app's own.
 *
 * Re-running continues automatically: rows that got an embedding drop out of
 * the query, so there is no cursor and no way to lose your place.
 *
 *   npx tsx --env-file=.env.local scripts/database/backfill-embeddings.mts
 *   npx tsx --env-file=.env.local scripts/database/backfill-embeddings.mts --limit 300
 *   npx tsx --env-file=.env.local scripts/database/backfill-embeddings.mts --dry-run
 *
 * --env-file is required: lib/supabase.ts reads process.env at module scope, so
 * a dotenv call inside this file would run too late.
 *
 * For unattended progress, prefer the cron route — the quota resets daily and
 * the backfill needs many runs.
 */

import { backfillEmbeddings } from "../../lib/embedding-backfill"

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials — run with --env-file=.env.local")
    process.exit(1)
}
if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY — embeddings cannot be generated.")
    process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const limitArg = args.indexOf("--limit")
const limit = limitArg === -1 ? 300 : Number.parseInt(args[limitArg + 1], 10) || 300

console.log(`Backfilling up to ${limit} embeddings${dryRun ? " (DRY RUN)" : ""}…\n`)

const result = await backfillEmbeddings({ limit, dryRun })

if (result.attempted === 0) {
    console.log("Nothing to do — every row has an embedding.")
} else if (dryRun) {
    console.log(`${result.attempted} rows are missing an embedding (nothing written).`)
} else {
    console.log(`wrote ${result.written}, failed ${result.failed}, in ${Math.round(result.elapsedMs / 1000)}s`)
    if (result.quotaExhausted) {
        console.log("\nStopped early: the embedding quota looks exhausted. Re-run once it resets.")
    }
}

// Supabase keeps a handle open, so without an explicit exit the process
// lingers and redirected output never flushes. The tick of delay matters on
// Windows: exiting immediately while the client's handles are still closing
// trips a libuv assertion ("UV_HANDLE_CLOSING"), which looks like a crash even
// though the work and the output both completed.
// NO explicit process.exit here, deliberately.
//
// The sibling eval scripts do call it, because a lingering process with
// redirected stdout never flushed its output and looked like a hang. This one
// was given the same treatment and it was wrong twice over: exiting while the
// Supabase client's handles were still closing tripped a libuv assertion on
// Windows ("UV_HANDLE_CLOSING"), which reads as a crash, and the premise was
// false anyway — measured, this script terminates on its own with exit code 0.
// If a long run ever does hang here, prefer closing the client over forcing an
// exit mid-flight.
