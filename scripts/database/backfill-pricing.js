/**
 * Backfill the structured pricing columns from the free-text `pricing` field.
 *
 * Run AFTER supabase/migrations/add_structured_pricing.sql.
 *
 *   node scripts/database/backfill-pricing.js --dry-run    # report only, scans all rows
 *   node scripts/database/backfill-pricing.js              # write (resumes)
 *   node scripts/database/backfill-pricing.js --force      # reclassify everything
 *   node scripts/database/backfill-pricing.js --limit 500  # sample
 *
 * RESUMABLE BY DEFAULT: progress (cursor + any rows whose write failed) is
 * persisted to .backfill-pricing-state.json after every page. If a run dies
 * partway — statement timeout, dropped connection — just run it again and it
 * continues from the last completed page and retries the failed rows. Use
 * --force to start over from the beginning after changing the parser rules.
 *
 * Progress is tracked in that file rather than by querying for unclassified
 * rows, because `WHERE pricing_model IS NULL ORDER BY id` times out on this
 * table even with a partial index built for exactly that predicate, while the
 * unfiltered keyset scan used here reliably walks all 257k rows.
 *
 * Never touches the free-text `pricing` column, which stays authoritative for
 * display — only the five derived columns are written.
 *
 * The parser is a JS mirror of lib/pricing.ts. It is duplicated here rather than
 * imported because this is a plain-node script and lib/ is TypeScript; if you
 * change the rules in one, change them in both. The TS version is the one the
 * app uses and the one with the test expectations.
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

/**
 * Progress is persisted to disk rather than re-derived from the database.
 *
 * The obvious approach — "find rows WHERE pricing_model IS NULL" — does not
 * work on this table. Even with a partial index on exactly that predicate the
 * read timed out, while a PLAIN keyset scan over all rows reliably walked
 * 244,000 rows in one run. So progress is tracked here, in a file, and the
 * query stays the shape that is known to work.
 *
 * The file also carries the ids of batches whose write failed, so sporadic
 * statement timeouts (this instance produces them at random positions) get
 * retried on the next run instead of being silently lost.
 */
const STATE_FILE = path.join(__dirname, '.backfill-pricing-state.json');

function loadState() {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
        return { cursor: '', failedIds: [], written: 0 };
    }
}

function saveState(state) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('  (could not persist progress:', e.message + ')');
    }
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const HARD_LIMIT = limitArg > -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

// Resume picks up from the persisted cursor (see STATE_FILE above), so an
// interrupted run continues instead of redoing 250k rows. --force ignores the
// saved cursor and starts from the beginning — needed after changing parser
// rules, when every row genuinely has to be reclassified.
const FORCE = process.argv.includes('--force');

// Abort rather than emit hundreds of identical failures — the first run of this
// script printed dozens of the same constraint error before finishing, which
// buried the actual signal.
const MAX_CONSECUTIVE_FAILURES = 3;

const PAGE_SIZE = 1000;
// Kept modest deliberately. Each RPC call runs this many single-row UPDATEs
// server-side inside one statement, and the whole call has to finish within
// Postgres's statement_timeout. 500 was too close to the edge on a table this
// size with two partial indexes to maintain; 150 leaves comfortable headroom
// while still being one round trip per 150 rows.
const WRITE_BATCH = 150;

// Sanity ceilings — see the long note in lib/pricing.ts. Bare numbers above
// BARE_PERIOD_CEILING are treated as 'paid, period unknown' rather than
// inventing an absurd monthly price (the string "Free, $161270" produced
// $161,270/mo before this).
const BARE_PERIOD_CEILING = 2000;
const MAX_PLAUSIBLE_MONTHLY = 10000;

const PRICE_PATTERN = /\$\s?(\d+(?:[.,]\d+)?)\s*(?:-|–|to)\s*\$?\s?(\d+(?:[.,]\d+)?)|\$\s?(\d+(?:[.,]\d+)?)/gi;

const num = s => {
    if (!s) return null;
    const n = parseFloat(String(s).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

// Window is cut at the first tier boundary (comma, semicolon, next '$'), and
// year is tested before month. Without both, a LATER tier's period leaked into
// this one: "Free, $12/month, $144/year, $32/month" read $144 as monthly and
// produced $144/mo instead of $12/mo. See the note in lib/pricing.ts.
function periodAfter(text, index) {
    const window = text.slice(index, index + 28);
    const tail = window.split(/[,;]|\$/)[0].toLowerCase();
    if (/\/\s?(yr|year)|per year|annually|annual/.test(tail)) return 'year';
    if (/\/\s?(mo|month)|per month|monthly/.test(tail)) return 'month';
    if (/one[- ]?time|lifetime|once/.test(tail)) return 'once';
    return null;
}

function parsePricing(raw, accessType) {
    const text = String(raw ?? '').trim();
    if (!text) {
        return accessType === 'Free'
            ? { model: 'free', monthlyMinUsd: 0, monthlyMaxUsd: null, hasFreeTier: true, hasFreeTrial: false }
            : { model: 'unknown', monthlyMinUsd: null, monthlyMaxUsd: null, hasFreeTier: false, hasFreeTrial: false };
    }

    const lower = text.toLowerCase();
    const hasFreeTrial = /free\s+trial|trial\s+available|\d+[- ]day\s+trial/.test(lower);
    const hasFreeTier = /free\s+(tier|plan|forever|version)|freemium|open[\s-]?source|\bfree\b(?!\s*trial)/.test(lower);
    const usageBased = /per\s+(token|request|call|minute|image|credit|word|character|seat)|\/\s?(token|request|call|credit)|usage[\s-]based|pay[\s-]as[\s-]you[\s-]go|api pricing|\bcredits?\b/.test(lower);
    const custom = /custom(\s+pricing)?|contact\s+(us|sales|for)|enterprise\s+only|request\s+a?\s?quote|on\s+request/.test(lower);

    const monthly = [];
    let sawOneTime = false;
    for (const m of text.matchAll(PRICE_PATTERN)) {
        const period = periodAfter(text, (m.index ?? 0) + m[0].length);
        const values = m[3] !== undefined ? [num(m[3])] : [num(m[1]), num(m[2])];
        for (const v of values) {
            if (v === null || v <= 0) continue;
            if (period === 'year') monthly.push(v / 12);
            else if (period === 'once') sawOneTime = true;
            else if (v > BARE_PERIOD_CEILING) sawOneTime = true;
            else monthly.push(v);
        }
    }

    const hasPaid = monthly.length > 0 || sawOneTime;
    let model;
    if (usageBased) model = 'usage';
    else if (hasPaid && hasFreeTier) model = 'freemium';
    else if (hasPaid && hasFreeTrial) model = 'trial';
    else if (hasPaid) model = 'paid';
    else if (hasFreeTier) model = 'free';
    else if (custom) model = 'custom';
    else model = 'unknown';

    const round = n => Math.round(n * 100) / 100;
    const plausible = monthly.filter(n => n <= MAX_PLAUSIBLE_MONTHLY);
    return {
        model,
        monthlyMinUsd: plausible.length ? round(Math.min(...plausible)) : (model === 'free' ? 0 : null),
        monthlyMaxUsd: plausible.length ? round(Math.max(...plausible)) : null,
        hasFreeTier,
        hasFreeTrial,
    };
}

async function main() {
    console.log(`Pricing backfill${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);

    const modelCounts = {};
    let scanned = 0, written = 0, failed = 0;

    // KEYSET pagination, not .range()/OFFSET. Deep offsets make Postgres scan
    // and discard every preceding row, so cost grows with depth — an early
    // version of this script died with a statement timeout at offset 87,000.
    // Walking `id` with the primary-key index is flat-cost per page.
    const state = (DRY_RUN || FORCE) ? { cursor: '', failedIds: [], written: 0 } : loadState();
    let cursor = state.cursor || '';
    let failedIds = Array.isArray(state.failedIds) ? state.failedIds : [];

    if (!DRY_RUN && cursor) {
        console.log(`  resuming after id "${cursor}" (${state.written || 0} written previously, ${failedIds.length} rows queued for retry)`);
    }

    let consecutiveFailures = 0;
    let aborted = false;

    while (scanned < HARD_LIMIT) {
        const pageSize = Math.min(PAGE_SIZE, HARD_LIMIT - scanned);
        let read = supabase
            .from('ai_tools')
            .select('id, pricing, access_type')
            .gt('id', cursor)
            .order('id', { ascending: true })
            .limit(pageSize);

        // NOTE: deliberately NOT filtered by `pricing_model IS NULL`. That
        // predicate times out on this table even with a matching partial index,
        // whereas this unfiltered keyset scan reliably walks the whole table.
        // Already-done rows are skipped via the persisted cursor instead, and
        // rewriting a row that was already correct is harmless anyway.
        const { data, error } = await read;

        if (error) {
            console.error(`Read failed after id "${cursor}":`, error.message);
            if (!DRY_RUN) {
                console.error('Progress saved — run again to continue from here.');
            }
            break;
        }
        if (!data || data.length === 0) break;
        cursor = data[data.length - 1].id;

        const updates = data.map(row => {
            const p = parsePricing(row.pricing, row.access_type);
            modelCounts[p.model] = (modelCounts[p.model] || 0) + 1;
            return {
                id: row.id,
                pricing_model: p.model,
                price_monthly_min_usd: p.monthlyMinUsd,
                price_monthly_max_usd: p.monthlyMaxUsd,
                has_free_tier: p.hasFreeTier,
                has_free_trial: p.hasFreeTrial,
            };
        });

        if (!DRY_RUN) {
            // Bulk partial-column UPDATE via RPC. NOT .upsert() — that generates
            // INSERT ... ON CONFLICT, whose INSERT half must satisfy every NOT
            // NULL column, so a payload of only the derived columns fails with
            // `null value in column "name"`. See bulk_update_tool_pricing in
            // supabase/migrations/add_structured_pricing.sql.
            for (let i = 0; i < updates.length; i += WRITE_BATCH) {
                const batch = updates.slice(i, i + WRITE_BATCH);
                const { data: affected, error: writeError } = await supabase
                    .rpc('bulk_update_tool_pricing', { payload: batch });

                if (writeError) {
                    if (writeError.message?.includes('does not exist')) {
                        console.error(
                            '\nbulk_update_tool_pricing() is missing — run ' +
                            'supabase/migrations/add_structured_pricing.sql first.\n'
                        );
                        process.exit(1);
                    }
                    console.error(`  write failed (${batch.length} rows):`, writeError.message);
                    failed += batch.length;
                    // Queue for retry on a later run rather than losing them —
                    // these timeouts hit random batches, not a systematic point.
                    failedIds.push(...batch.map(b => b.id));
                    if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                        console.error(
                            `\nAborting after ${consecutiveFailures} consecutive write failures — ` +
                            `fix the cause rather than letting this grind through 250k rows.\n` +
                            `Progress is preserved: re-running resumes from the first unclassified row.`
                        );
                        aborted = true;
                        break;
                    }
                } else {
                    consecutiveFailures = 0;
                    written += (typeof affected === 'number' ? affected : batch.length);
                }
            }
        }

        // Persist after every page so an abrupt failure costs at most one page.
        if (!DRY_RUN) {
            saveState({ cursor, failedIds, written: (state.written || 0) + written });
        }

        if (aborted) break;

        scanned += data.length;
        if (scanned % 5000 === 0 || data.length < pageSize) {
            console.log(`  scanned ${scanned}${DRY_RUN ? '' : `, written ${written}`}`);
        }
        if (data.length < pageSize) break;
    }

    // Retry rows whose write failed on an earlier run. Fetched BY ID (.in()),
    // which uses the primary key — not by a `pricing_model IS NULL` filter,
    // which is the query shape that times out on this table.
    if (!DRY_RUN && !aborted && failedIds.length > 0) {
        const toRetry = [...new Set(failedIds)];
        console.log(`\nretrying ${toRetry.length} previously failed rows...`);
        const stillFailed = [];

        for (let i = 0; i < toRetry.length; i += WRITE_BATCH) {
            const idChunk = toRetry.slice(i, i + WRITE_BATCH);
            const { data: rows, error: readErr } = await supabase
                .from('ai_tools')
                .select('id, pricing, access_type')
                .in('id', idChunk);

            if (readErr || !rows) {
                stillFailed.push(...idChunk);
                continue;
            }

            const payload = rows.map(row => {
                const p = parsePricing(row.pricing, row.access_type);
                return {
                    id: row.id,
                    pricing_model: p.model,
                    price_monthly_min_usd: p.monthlyMinUsd,
                    price_monthly_max_usd: p.monthlyMaxUsd,
                    has_free_tier: p.hasFreeTier,
                    has_free_trial: p.hasFreeTrial,
                };
            });

            const { error: retryErr } = await supabase.rpc('bulk_update_tool_pricing', { payload });
            if (retryErr) {
                stillFailed.push(...idChunk);
            } else {
                written += payload.length;
                failed = Math.max(0, failed - payload.length);
            }
        }

        failedIds = stillFailed;
        saveState({ cursor, failedIds, written: (state.written || 0) + written });
        console.log(
            stillFailed.length === 0
                ? '  all retried rows written'
                : `  ${stillFailed.length} still failing — queued for the next run`
        );
    }

    if (aborted) {
        console.log('\n(run aborted early — see the error above; re-run to resume)');
    }
    console.log(`\nscanned ${scanned} rows${DRY_RUN ? '' : `, wrote ${written}, failed ${failed}`}`);
    console.log('pricing_model distribution:');
    Object.entries(modelCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
        console.log(`  ${k.padEnd(9)} ${String(v).padStart(7)}  ${Math.round((v / scanned) * 100)}%`));
    const unknown = modelCounts.unknown || 0;
    if (scanned === 0) {
        console.log(
            written > 0
                ? '\nNo new rows to scan — the cursor is at the end of the table.'
                : '\nNothing to do — the cursor is at the end of the table, or the read above failed.'
        );
    } else {
        console.log(`\nclassified: ${Math.round(((scanned - unknown) / scanned) * 100)}%`);
    }
}

main();
