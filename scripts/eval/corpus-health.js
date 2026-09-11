/**
 * Quantifies two corpus-data problems that limit search quality independently
 * of any ranking work:
 *
 *   1. DUPLICATE PRODUCTS — the same tool ingested many times under different
 *      ids. search_tools_advanced masks this at query time with
 *      DISTINCT ON (normalized name), which is why results look clean, but the
 *      duplicates still consume the bounded candidate pool: if 30 candidate
 *      slots hold 10 distinct products, ranking is choosing from 10.
 *
 *   2. MISCATEGORISED TOOLS — the category tabs on /tools are only as good as
 *      the category column. Observed: Klap (turns long video into clips) and
 *      Latte Social (video editing) both filed under "Code & Development",
 *      Sourcio (hiring) under "Productivity".
 *
 * READ-ONLY. It writes nothing, because fixing either problem means mutating
 * hundreds of thousands of rows and that is a decision to take deliberately,
 * not a side effect of a measurement.
 *
 * Sampling note: counts are over the most-viewed rows rather than the whole
 * table, because `count: 'exact'` over 260k rows times out (measured). Popular
 * rows are also the ones users actually see, so the sample is the part that
 * matters — but it is a SAMPLE, and the output says so.
 *
 * Run with:
 *   node scripts/eval/corpus-health.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/** PostgREST caps a single response at 1000 rows. */
const PAGE = 1000;
const PAGES = 5;

/** Same normalization search_tools_advanced dedups on, so these numbers
 *  describe the duplicates that function is actually collapsing. */
const normalize = name => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * High-confidence category signals. Deliberately few and unambiguous: the point
 * is a defensible floor on how many rows are misfiled, not a full
 * recategorisation. A tool whose description is about editing video is not in
 * "Code & Development" by accident.
 */
const SIGNALS = [
    { expect: 'video', category: /video/i, cues: [/\bvideo edit/i, /\bvideo clip/i, /short[- ]form video/i, /\bfootage\b/i] },
    { expect: 'image', category: /image|design|photo/i, cues: [/\bimage generat/i, /\bphoto edit/i, /\bthumbnail/i] },
    { expect: 'audio', category: /audio|music|voice/i, cues: [/\bvoiceover\b/i, /text[- ]to[- ]speech/i, /\btranscrib/i] },
    { expect: 'chatbot', category: /chat|bot|agent/i, cues: [/\bchatbot\b/i, /\bconversational agent/i] },
];

(async () => {
    const rows = [];
    for (let page = 0; page < PAGES; page++) {
        const { data, error } = await db
            .from('ai_tools')
            .select('id, name, category, description, popularity')
            .order('popularity', { ascending: false, nullsFirst: false })
            .range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) {
            console.error(`page ${page} failed: ${error.message.slice(0, 60)}`);
            break;
        }
        if (!data || data.length === 0) break;
        rows.push(...data);
    }

    console.log(`Sampled ${rows.length} rows (most-viewed first).\n`);

    // ---- 1. Duplicates -----------------------------------------------------
    const byName = new Map();
    for (const r of rows) {
        const key = normalize(r.name);
        if (!key) continue;
        byName.set(key, (byName.get(key) || 0) + 1);
    }
    const distinct = byName.size;
    const duplicatedNames = [...byName.values()].filter(n => n > 1).length;
    const redundantRows = [...byName.values()].reduce((sum, n) => sum + (n - 1), 0);

    console.log('=== duplicate products ===');
    console.log(`  distinct products      ${distinct}`);
    console.log(`  names appearing >1x    ${duplicatedNames}`);
    console.log(`  redundant rows         ${redundantRows}  (${Math.round((redundantRows / rows.length) * 100)}% of the sample)`);
    console.log('  worst offenders:');
    [...byName.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .forEach(([key, n]) => {
            const example = rows.find(r => normalize(r.name) === key);
            console.log(`    ${String(n).padStart(3)}x  ${example ? example.name : key}`);
        });

    // ---- 2. Miscategorisation ---------------------------------------------
    console.log('\n=== miscategorised (high-confidence signals only) ===');
    let mismatches = 0;
    const examples = [];
    for (const r of rows) {
        const text = `${r.name} ${r.description || ''}`;
        for (const sig of SIGNALS) {
            if (sig.cues.some(c => c.test(text)) && !sig.category.test(r.category || '')) {
                mismatches++;
                if (examples.length < 10) {
                    examples.push(`    ${String(r.name).slice(0, 32).padEnd(34)} [${r.category}]  looks like: ${sig.expect}`);
                }
                break;
            }
        }
    }
    console.log(`  rows contradicting their category   ${mismatches}  (${Math.round((mismatches / rows.length) * 100)}% of the sample)`);
    examples.forEach(e => console.log(e));

    console.log('\nNOTE: a sample of the most-viewed rows, not the full 260k table.');
    console.log('Nothing was written. Both fixes mutate large numbers of rows.');
})();
