/**
 * Backfill missing tool embeddings, MOST-VIEWED FIRST.
 *
 * WHY THIS EXISTS: only 11% of the 2000 most-viewed rows have an embedding
 * (measured 221/2000). The semantic tier of search_tools_advanced requires
 * `embedding IS NOT NULL`, so it can only see that 11% — and because
 * keyword_score saturates at its cap for effectively every candidate, vector
 * similarity is what actually orders results. Anything without an embedding
 * lands in an undifferentiated band where every combined_score ties and
 * popularity breaks the tie.
 *
 * That is the measured cause of the search failure that resisted every ranking
 * fix: for "schedule social media posts", SocialBee (popularity 100, a real
 * scheduler) has a NULL embedding and lost to TweetAssist (a Chrome extension
 * for composing tweets) which has one. Buffer, Circleboom, Predis.ai and
 * Magicpost are all NULL too.
 *
 * WHY NOT THE EXISTING SCRIPTS: scripts/database/generate-embeddings.ts and
 * /api/admin/generate-embeddings both select `.is('embedding', null)` with NO
 * ordering, so they work through arbitrary rows — and 55% of this table is
 * duplicate re-ingests of a few repos (tensorflow x356). They spend quota on
 * rows nobody sees. This one walks popularity DESC instead.
 *
 * Re-running simply continues: rows that got an embedding drop out of the
 * query, so there is no cursor to keep and no way to lose your place.
 *
 *   node scripts/database/backfill-embeddings.js --dry-run
 *   node scripts/database/backfill-embeddings.js --limit 300
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const readArg = (flag, fallback) => {
    const i = args.indexOf(flag);
    if (i === -1) return fallback;
    const n = Number.parseInt(args[i + 1], 10);
    return Number.isFinite(n) ? n : fallback;
};

/** Rows to embed this run. Bounded because embeddings share the Gemini quota
 *  with every reasoning call in the app; a run that exhausts it takes the
 *  recommendation feature down with it. */
const LIMIT = readArg('--limit', 300);
/** Escape hatch only: step over leading rows that keep failing. Not needed for
 *  normal progress — filled rows leave the result set on their own. */
const SKIP = readArg('--skip', 0);

/** 300 measured at ~5.3s for the filtered query; 1000 exceeds the timeout. */
const PAGE = 300;
/** Must match lib/embeddings.ts. The column is vector(768); the model returns
 *  3072 by default, so omitting this writes a value the DB will reject. */
const OUTPUT_DIMENSIONALITY = 768;
const EMBEDDING_MODEL = 'gemini-embedding-001';
/** Sequential with a pause. The free tier rate-limits embeddings aggressively
 *  and a 429 storm wastes the whole run. */
const DELAY_MS = 120;
/** Give up rather than hammer a quota that is clearly gone. */
const MAX_CONSECUTIVE_FAILURES = 8;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Same text composition the app uses when embedding a tool, so backfilled
 *  vectors live in the same space as ones generated at write time. */
const embedText = row =>
    [row.name, row.category, row.description, (row.tags || []).join(' ')]
        .filter(Boolean)
        .join(' — ')
        .slice(0, 8000);

(async () => {
    console.log(`Backfilling embeddings — limit ${LIMIT}, skip ${SKIP}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

    // Ask for exactly the rows that need work: most-popular-first among those
    // with no embedding.
    //
    // An earlier version of this script paged through popularity DESC and
    // filtered client-side, on the assumption — carried over from the pricing
    // backfill — that combining `IS NULL` with `ORDER BY popularity` would time
    // out. Measured on this table, that assumption was wrong here:
    //
    //     select including the embedding column, range(0,999)   10217ms  <- times out
    //     is(embedding,null) + order popularity + range(0,299)   5256ms  <- fine
    //     is(embedding,null) + order popularity + range(0,49)    2620ms
    //
    // The real cost was SELECTING the vector column: 1000 rows x 768 floats is a
    // multi-megabyte payload, and it grew as coverage improved until the query
    // died — the script got slower the better it worked. Filtering on the column
    // instead of fetching it is both cheaper and exact, and it makes --skip
    // unnecessary, since filled rows drop out of the result on the next run.
    const todo = [];
    let scanned = 0;

    while (todo.length < LIMIT) {
        const want = Math.min(PAGE, LIMIT - todo.length);
        const { data, error } = await db
            .from('ai_tools')
            .select('id, name, category, description, tags, popularity')
            .is('embedding', null)
            .order('popularity', { ascending: false, nullsFirst: false })
            .range(SKIP + scanned, SKIP + scanned + want - 1);

        if (error) {
            console.error(`  fetch failed: ${error.message.slice(0, 70)}`);
            break;
        }
        if (!data || data.length === 0) break;

        todo.push(...data);
        scanned += data.length;
        if (data.length < want) break;
    }
    console.log(`Fetched ${todo.length} of the most-popular rows with no embedding.\n`);
    if (todo.length === 0) return;

    if (DRY_RUN) {
        todo.slice(0, 25).forEach(r => console.log(`  would embed: ${String(r.name).slice(0, 40).padEnd(42)} pop=${r.popularity}`));
        console.log(`\n(dry run — nothing written)`);
        return;
    }

    let written = 0;
    let failed = 0;
    let consecutiveFailures = 0;

    for (const row of todo) {
        try {
            const result = await model.embedContent({
                content: { role: 'user', parts: [{ text: embedText(row) }] },
                outputDimensionality: OUTPUT_DIMENSIONALITY,
            });
            const values = result.embedding.values;
            if (!Array.isArray(values) || values.length !== OUTPUT_DIMENSIONALITY) {
                throw new Error(`unexpected dimensionality ${values ? values.length : 'none'}`);
            }

            const { error } = await db.from('ai_tools').update({ embedding: values }).eq('id', row.id);
            if (error) throw new Error(error.message);

            written++;
            consecutiveFailures = 0;
            if (written % 25 === 0) console.log(`  ${written}/${todo.length} written…`);
        } catch (err) {
            failed++;
            consecutiveFailures++;
            const msg = String(err.message || err);
            console.log(`  FAIL ${String(row.name).slice(0, 32).padEnd(34)} ${msg.slice(0, 70)}`);
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                console.log(`\nStopping: ${MAX_CONSECUTIVE_FAILURES} consecutive failures (quota is likely gone).`);
                break;
            }
            // Back off harder on rate limiting than on a bad row.
            await sleep(/429|quota|rate/i.test(msg) ? 5000 : 500);
        }
        await sleep(DELAY_MS);
    }

    console.log(`\nwrote ${written}, failed ${failed}`);
    console.log('Re-run to continue — filled rows drop out of the query automatically.');
})();
