/**
 * Retrieval determinism + latency check for search_tools_advanced.
 *
 * WHY: the function's breadth tiers used `LIMIT n` with no ORDER BY, on the
 * documented reasoning that an arbitrary recall slice was harmless. It was not.
 * Measured before the fix, six consecutive FTS-only calls with an identical
 * query returned six COMPLETELY DISJOINT sets of 30 ids, /api/recommend gave
 * three different best matches over six identical calls, and the eval's
 * precision@1 moved 69% -> 65% between two runs of unchanged code.
 *
 * This script is the regression test for that. It asserts two things:
 *   1. determinism — N identical calls return the same ids in the same order
 *   2. latency     — the deterministic ordering did not reintroduce the
 *                    timeout class of bug the function exists to prevent
 *
 * Run after applying fix_advanced_search_bounded_retrieval.sql:
 *   node scripts/eval/retrieval-determinism.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RUNS = 5;

/** Budget per call. The function's whole purpose is bounded latency; anything
 *  slower than this is the failure mode it was written to prevent. */
const LATENCY_BUDGET_MS = 5000;

/**
 * Goal-shaped queries (the ones the recommendation path actually sends) plus
 * the two shapes historically measured as pathological: a rare term whose
 * trigrams are common, and an OR of a very common lexeme.
 */
const QUERIES = [
    'build a chatbot trained on my own documents',
    'find and fix bugs in my codebase',
    'help me study for an exam',
    'edit my video by typing instead of timelines',
    'image generator',
    'gauth ai',
];

async function callRpc(query) {
    const started = Date.now();
    // query_embedding null on purpose: isolates the SQL function from the
    // embedding tier, which shares the Gemini quota and would otherwise make
    // this test's results depend on quota state.
    const { data, error } = await db.rpc('search_tools_advanced', {
        search_query: query,
        query_embedding: null,
        match_threshold: 0.20,
        match_count: 30,
        extra_keywords: null,
    });
    return { ms: Date.now() - started, error, ids: (data || []).map(r => r.id) };
}

(async () => {
    console.log(`Retrieval determinism — ${QUERIES.length} queries x ${RUNS} identical calls\n`);

    let unstable = 0;
    let overBudget = 0;
    let failed = 0;

    let coldSlow = 0;

    for (const query of QUERIES) {
        // First call measured SEPARATELY, not discarded. The deterministic
        // ORDER BY t.id makes the planner walk the primary key and recheck the
        // FTS predicate per row, which is cheap warm but pays full heap-fetch
        // cost on a cold cache. Measured on "find and fix bugs in my
        // codebase": 9093ms on the first call (over the 8s statement timeout),
        // then 273-490ms for the next seven. Folding that into the same number
        // as steady state would either hide a real cold-start regression or
        // fail this test forever depending on cache state, so it gets its own
        // line. An RPC timeout is not fatal in the app — hybridSearch returns
        // status:'error' and lib/retrieval.ts falls through to the FTS tier.
        const cold = await callRpc(query);

        const runs = [];
        for (let i = 0; i < RUNS; i++) runs.push(await callRpc(query));

        const coldNote = cold.error
            ? `cold=TIMEOUT(${cold.ms}ms)`
            : cold.ms > LATENCY_BUDGET_MS
                ? `cold=${cold.ms}ms(SLOW)`
                : `cold=${cold.ms}ms`;
        if (cold.error || cold.ms > LATENCY_BUDGET_MS) coldSlow++;

        const errored = runs.find(r => r.error);
        if (errored) {
            failed++;
            console.log(`  ERROR  "${query}" -> ${(errored.error.message || '').slice(0, 70)}  ${coldNote}`);
            continue;
        }

        const orderings = new Set(runs.map(r => r.ids.join(',')));
        const sets = new Set(runs.map(r => [...r.ids].sort().join(',')));
        const times = runs.map(r => r.ms);
        const worst = Math.max(...times);

        const stable = orderings.size === 1;
        if (!stable) unstable++;
        if (worst > LATENCY_BUDGET_MS) overBudget++;

        console.log(
            `  ${stable ? 'stable  ' : 'UNSTABLE'} ` +
            `orderings=${orderings.size} sets=${sets.size} ` +
            `n=${String(runs[0].ids.length).padStart(2)} ` +
            `ms=${times.join('/')} ` +
            `${worst > LATENCY_BUDGET_MS ? 'OVER BUDGET ' : ''}` +
            `${coldNote}  | "${query}"`
        );
    }

    console.log('\n' + '='.repeat(64));
    console.log(`unstable queries     ${unstable}/${QUERIES.length}   (target 0)`);
    console.log(`over ${LATENCY_BUDGET_MS}ms          ${overBudget}/${QUERIES.length}   (target 0)`);
    console.log(`errored (steady)     ${failed}/${QUERIES.length}`);
    console.log(`cold call slow/fail  ${coldSlow}/${QUERIES.length}   (informational — degrades to the FTS tier, see note above)`);
    console.log('='.repeat(64));

    if (unstable || overBudget || failed) {
        console.log('\nFAIL — see the rows above.');
        process.exitCode = 1;
    } else {
        console.log('\nPASS — retrieval is reproducible and within budget.');
    }
})();
